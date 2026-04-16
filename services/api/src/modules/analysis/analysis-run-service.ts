import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { requestAnthropicRecommendationJson } from '../recommendations/anthropic-recommendation-llm-adapter.js';
import { tryResolveUserAiCredentials } from '../ai/resolve-user-ai-credentials.js';
import type { UserAiSettingsRepository } from '../ai/user-ai-settings-repository.js';
import { PortfolioService } from '../portfolio/portfolio-service.js';
import type { AnalysisReportRecord, AnalysisRunRecord, AnalysisRunSummaryDto, AnalysisStatus, AnalysisType } from './analysis-types.js';
import { ANALYSIS_TYPES } from './analysis-types.js';
import { AnalysisRunRepository } from './analysis-run-repository.js';

const STATUS_PROCESSING: AnalysisStatus = 'PROCESSING';
const STATUS_COMPLETED: AnalysisStatus = 'COMPLETED';

type ReportStorage = {
  readonly bucketName: string | null;
  readonly s3Client?: S3Client;
};

type TechnicalAnalysisInput = {
  readonly symbol: string;
  readonly includePosition: boolean;
};

export class AnalysisRunService {
  private readonly analysisRunRepository: AnalysisRunRepository;
  private readonly portfolioService: PortfolioService;
  private readonly userAiSettingsRepository: UserAiSettingsRepository;
  private readonly reportStorage: ReportStorage;

  public constructor(input: {
    readonly analysisRunRepository: AnalysisRunRepository;
    readonly portfolioService: PortfolioService;
    readonly userAiSettingsRepository: UserAiSettingsRepository;
    readonly reportStorage: ReportStorage;
  }) {
    this.analysisRunRepository = input.analysisRunRepository;
    this.portfolioService = input.portfolioService;
    this.userAiSettingsRepository = input.userAiSettingsRepository;
    this.reportStorage = input.reportStorage;
  }

  public async createRun(input: {
    readonly userId: string;
    readonly username: string;
    readonly now: Date;
    readonly type: AnalysisType;
    readonly parameters: Record<string, unknown>;
  }): Promise<AnalysisRunSummaryDto> {
    const portfolio = await this.portfolioService.getOrCreateForUser({
      userId: input.userId,
      now: input.now,
    });
    const runId: string = randomUUID();
    const reportId: string = randomUUID();
    const createdAtIso: string = input.now.toISOString();
    const processingRun: AnalysisRunRecord = {
      runId,
      portfolioId: portfolio.portfolioId,
      type: input.type,
      status: STATUS_PROCESSING,
      parametersJson: JSON.stringify(input.parameters),
      summary: buildRunSummary({ type: input.type, parameters: input.parameters }),
      createdAtIso,
      completedAtIso: null,
      reportId: null,
      errorMessage: null,
    };
    await this.analysisRunRepository.putRun({ userId: input.userId, record: processingRun });

    try {
      const markdownBody: string = await this.generateReportMarkdown({
        userId: input.userId,
        type: input.type,
        summary: processingRun.summary,
        username: input.username,
        createdAtIso,
        parameters: input.parameters,
      });
      const completedAtIso: string = new Date().toISOString();
      const storage = await this.persistReportToS3({
        runId,
        type: input.type,
        createdAtIso,
        markdownBody,
      });
      const reportRecord: AnalysisReportRecord = {
        reportId,
        runId,
        portfolioId: portfolio.portfolioId,
        type: input.type,
        title: buildReportTitle({ type: input.type }),
        summary: summarizeReport({ fallback: processingRun.summary, markdownBody }),
        markdownBody,
        storageBucket: storage.bucketName,
        storageKey: storage.storageKey,
        createdAtIso: completedAtIso,
        createdBy: input.username,
      };
      const completedRun: AnalysisRunRecord = {
        ...processingRun,
        status: STATUS_COMPLETED,
        completedAtIso,
        reportId,
        summary: reportRecord.summary,
      };
      await this.analysisRunRepository.putReport({ userId: input.userId, record: reportRecord });
      await this.analysisRunRepository.putRun({ userId: input.userId, record: completedRun });
      return toRunSummaryDto({ run: completedRun });
    } catch (error) {
      const failedRun: AnalysisRunRecord = {
        ...processingRun,
        status: 'FAILED',
        completedAtIso: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : 'Failed to generate analysis report.',
      };
      await this.analysisRunRepository.putRun({ userId: input.userId, record: failedRun });
      throw error;
    }
  }

  public async listRuns(input: {
    readonly userId: string;
    readonly now: Date;
    readonly limit: number;
  }): Promise<readonly AnalysisRunSummaryDto[]> {
    const portfolio = await this.portfolioService.getOrCreateForUser({ userId: input.userId, now: input.now });
    const runs = await this.analysisRunRepository.listRuns({
      userId: input.userId,
      portfolioId: portfolio.portfolioId,
      limit: input.limit,
    });
    return runs.map((run) => toRunSummaryDto({ run }));
  }

  public async listReports(input: {
    readonly userId: string;
    readonly now: Date;
    readonly limit: number;
  }): Promise<readonly AnalysisReportRecord[]> {
    const portfolio = await this.portfolioService.getOrCreateForUser({ userId: input.userId, now: input.now });
    return this.analysisRunRepository.listReports({
      userId: input.userId,
      portfolioId: portfolio.portfolioId,
      limit: input.limit,
    });
  }

  public async getRunById(input: {
    readonly userId: string;
    readonly now: Date;
    readonly runId: string;
  }): Promise<AnalysisRunSummaryDto | undefined> {
    const runs = await this.listRuns({ userId: input.userId, now: input.now, limit: 100 });
    return runs.find((run) => run.runId === input.runId);
  }

  public async getReportById(input: {
    readonly userId: string;
    readonly now: Date;
    readonly reportId: string;
  }): Promise<AnalysisReportRecord | undefined> {
    const reports = await this.listReports({ userId: input.userId, now: input.now, limit: 200 });
    return reports.find((report) => report.reportId === input.reportId);
  }

  private async persistReportToS3(input: {
    readonly runId: string;
    readonly type: AnalysisType;
    readonly createdAtIso: string;
    readonly markdownBody: string;
  }): Promise<{ readonly bucketName: string | null; readonly storageKey: string | null }> {
    if (this.reportStorage.bucketName === null || this.reportStorage.s3Client === undefined) {
      return { bucketName: null, storageKey: null };
    }
    const compactTimestamp: string = input.createdAtIso.replace(/[-:.]/g, '').replace('T', '-').replace('Z', '');
    const storageKey: string = `${input.type}-${compactTimestamp}-${input.runId}.md`;
    await this.reportStorage.s3Client.send(
      new PutObjectCommand({
        Bucket: this.reportStorage.bucketName,
        Key: storageKey,
        Body: input.markdownBody,
        ContentType: 'text/markdown; charset=utf-8',
      }),
    );
    return { bucketName: this.reportStorage.bucketName, storageKey };
  }

  private async generateReportMarkdown(input: {
    readonly userId: string;
    readonly type: AnalysisType;
    readonly summary: string;
    readonly username: string;
    readonly createdAtIso: string;
    readonly parameters: Record<string, unknown>;
  }): Promise<string> {
    if (input.type !== 'technical-analysis') {
      return buildMarkdownReport({
        type: input.type,
        summary: input.summary,
        username: input.username,
        createdAtIso: input.createdAtIso,
        parameters: input.parameters,
      });
    }
    const technicalInput: TechnicalAnalysisInput = parseTechnicalAnalysisInput({ parameters: input.parameters });
    const userCredentials = await tryResolveUserAiCredentials({
      userAiSettingsRepository: this.userAiSettingsRepository,
      userId: input.userId,
    });
    if (userCredentials === undefined) {
      throw new Error('AI credentials are not configured. Please set your Anthropic API key in Settings.');
    }
    const prompt: string = buildTechnicalAnalysisPrompt({ input: technicalInput });
    const systemPrompt: string =
      'You are a senior quantitative trader writing actionable markdown investment reports. Return markdown only.';
    const reportMarkdown: string = await requestAnthropicRecommendationJson({
      apiKey: userCredentials.apiKey,
      model: userCredentials.modelId,
      system: systemPrompt,
      user: prompt,
    });
    if (reportMarkdown.trim().length === 0) {
      throw new Error('AI response was empty for technical analysis.');
    }
    return reportMarkdown.trim();
  }
}

function buildRunSummary(input: { readonly type: AnalysisType; readonly parameters: Record<string, unknown> }): string {
  if (input.type === 'technical-analysis') {
    const symbol: string = typeof input.parameters['symbol'] === 'string' ? input.parameters['symbol'] : 'N/A';
    return `Technical analysis prepared for ${symbol.toUpperCase()}.`;
  }
  if (input.type === 'portfolio-builder') {
    const riskTolerance: string =
      typeof input.parameters['riskTolerance'] === 'string' ? input.parameters['riskTolerance'] : 'moderate';
    return `Portfolio allocation proposal generated for ${riskTolerance} risk tolerance.`;
  }
  return `${humanizeAnalysisType(input.type)} report generated.`;
}

function buildMarkdownReport(input: {
  readonly type: AnalysisType;
  readonly summary: string;
  readonly username: string;
  readonly createdAtIso: string;
  readonly parameters: Record<string, unknown>;
}): string {
  return [
    `# ${buildReportTitle({ type: input.type })}`,
    '',
    `- Generated for: ${input.username}`,
    `- Generated at: ${input.createdAtIso}`,
    `- Analysis type: ${input.type}`,
    '',
    '## Executive Summary',
    input.summary,
    '',
    '## Input Parameters',
    '```json',
    JSON.stringify(input.parameters, null, 2),
    '```',
    '',
    '## Notes',
    'This MVP report is generated from the analysis run payload and persisted for Library retrieval.',
  ].join('\n');
}

function parseTechnicalAnalysisInput(input: { readonly parameters: Record<string, unknown> }): TechnicalAnalysisInput {
  const rawSymbol: unknown = input.parameters['symbol'];
  const rawIncludePosition: unknown = input.parameters['includePosition'];
  const symbol: string = typeof rawSymbol === 'string' ? rawSymbol.trim().toUpperCase() : '';
  if (symbol.length === 0) {
    throw new Error('Ticker symbol is required for technical analysis.');
  }
  return {
    symbol,
    includePosition: rawIncludePosition === true,
  };
}

function buildTechnicalAnalysisPrompt(input: { readonly input: TechnicalAnalysisInput }): string {
  const positionClause: string = input.input.includePosition
    ? `Current position context: Include current holdings context for ${input.input.symbol} if available.`
    : `Current position context: Ignore portfolio position context and analyze ${input.input.symbol} standalone.`;
  return `You are a senior quantitative trader at Badgers Finance who combines technical analysis with statistical models to time entries and exits.

I need a full technical analysis breakdown of a stock.

Analyze:

* Current trend direction on daily, weekly, and monthly timeframes
* Key support and resistance levels with exact price points
* Moving average analysis (50-day, 100-day, 200-day) and crossover signals
* RSI, MACD, and Bollinger Band readings with plain-English interpretation
* Volume trend analysis and what it signals about buyer vs seller strength
* Chart pattern identification (head and shoulders, cup and handle, etc.)
* Fibonacci retracement levels for potential bounce zones
* Ideal entry price, stop-loss level, and profit target
* Risk-to-reward ratio for the current setup
* Confidence rating: strong buy, buy, neutral, sell, strong sell

Format as a technical analysis report card with a clear trade plan summary. Store as Markdown + sidecar assets. e.g.

/badgers-investments-reports-dev
  technical-analysis-${input.input.symbol}-[timestamp].md
  technical-analysis-${input.input.symbol}-[timestamp]/
    graph1.png
    graph2.png

The stock to analyze: ${input.input.symbol}
${positionClause}`;
}

function summarizeReport(input: { readonly fallback: string; readonly markdownBody: string }): string {
  const lines: readonly string[] = input.markdownBody
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#') && !line.startsWith('*') && !line.startsWith('-'));
  return lines[0] ?? input.fallback;
}

function buildReportTitle(input: { readonly type: AnalysisType }): string {
  return `${humanizeAnalysisType(input.type)} Report`;
}

function humanizeAnalysisType(type: AnalysisType): string {
  return type
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function toRunSummaryDto(input: { readonly run: AnalysisRunRecord }): AnalysisRunSummaryDto {
  return {
    runId: input.run.runId,
    portfolioId: input.run.portfolioId,
    type: input.run.type,
    status: input.run.status.toLowerCase() as Lowercase<AnalysisStatus>,
    createdAt: input.run.createdAtIso,
    completedAt: input.run.completedAtIso,
    summary: input.run.summary,
    reportId: input.run.reportId,
    errorMessage: input.run.errorMessage,
  };
}

export function isAnalysisType(value: string): value is AnalysisType {
  return ANALYSIS_TYPES.includes(value as AnalysisType);
}

import type { FastifyBaseLogger } from 'fastify';
import { randomUUID } from 'node:crypto';
import { requestAnthropicRecommendationJson } from '../recommendations/anthropic-recommendation-llm-adapter.js';
import { tryResolveUserAiCredentials } from '../ai/resolve-user-ai-credentials.js';
import type { UserAiSettingsRepository } from '../ai/user-ai-settings-repository.js';
import { PortfolioService } from '../portfolio/portfolio-service.js';
import type { AnalysisReportRecord, AnalysisRunRecord, AnalysisRunSummaryDto, AnalysisStatus, AnalysisType } from './analysis-types.js';
import { ANALYSIS_TYPES } from './analysis-types.js';
import { persistAnalysisReportBundle, type ReportStorage } from './analysis-report-storage.js';
import { AnalysisRunRepository } from './analysis-run-repository.js';
import { buildAnalysisReportSummarySentence } from './build-analysis-report-summary-sentence.js';
import type { TechnicalAnalysisBundleChartContext } from './bundle-chart-context.js';
import type { TechnicalAnalysisComputationPayload } from './compute-technical-analysis-payload.js';
import { loadBundleManifestFromS3 } from './load-bundle-manifest-from-s3.js';
import {
  buildPortfolioBuilderPrompt,
  parsePortfolioBuilderInput,
  PORTFOLIO_BUILDER_SYSTEM_PROMPT,
} from './portfolio-builder-run.js';
import { presignBundleAssetUrls } from './presign-analysis-bundle-assets.js';
import {
  prepareTechnicalAnalysisLlmContext,
  TECHNICAL_ANALYSIS_SYSTEM_PROMPT,
} from './technical-analysis-run.js';

const STATUS_PROCESSING: AnalysisStatus = 'PROCESSING';
const STATUS_COMPLETED: AnalysisStatus = 'COMPLETED';

export class AnalysisRunService {
  private readonly analysisRunRepository: AnalysisRunRepository;
  private readonly portfolioService: PortfolioService;
  private readonly userAiSettingsRepository: UserAiSettingsRepository;
  private readonly reportStorage: ReportStorage;
  private readonly log: FastifyBaseLogger;

  public constructor(input: {
    readonly analysisRunRepository: AnalysisRunRepository;
    readonly portfolioService: PortfolioService;
    readonly userAiSettingsRepository: UserAiSettingsRepository;
    readonly reportStorage: ReportStorage;
    readonly log: FastifyBaseLogger;
  }) {
    this.analysisRunRepository = input.analysisRunRepository;
    this.portfolioService = input.portfolioService;
    this.userAiSettingsRepository = input.userAiSettingsRepository;
    this.reportStorage = input.reportStorage;
    this.log = input.log;
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
      const generated = await this.generateReportMarkdown({
        userId: input.userId,
        type: input.type,
        summary: processingRun.summary,
        username: input.username,
        createdAtIso,
        parameters: input.parameters,
        now: input.now,
      });
      const completedAtIso: string = new Date().toISOString();
      const storage = await persistAnalysisReportBundle({
        reportStorage: this.reportStorage,
        type: input.type,
        parameters: input.parameters,
        reportTimestampIso: completedAtIso,
        markdownBody: generated.markdownBody,
        technicalPayload: generated.technicalPayload,
        technicalChartContext: generated.technicalChartContext,
      });
      const summarySentence: string = await buildAnalysisReportSummarySentence({
        type: input.type,
        parameters: input.parameters,
        markdownBody: storage.markdownBodyForRecord,
        fallbackLine: processingRun.summary,
      });
      const reportRecord: AnalysisReportRecord = {
        reportId,
        runId,
        portfolioId: portfolio.portfolioId,
        type: input.type,
        title: buildReportTitle({ type: input.type }),
        summary: summarySentence,
        markdownBody: storage.markdownBodyForRecord,
        storageBucket: storage.bucketName,
        storageKey: storage.storageKey,
        storageBundlePrefix: storage.storageBundlePrefix,
        storageManifestKey: storage.storageManifestKey,
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

  /**
   * Presigned URLs for bundle assets when ADR-013 manifest exists.
   */
  public async getPresignedBundleAssetUrlsForReport(input: {
    readonly report: AnalysisReportRecord;
  }): Promise<Record<string, string> | null> {
    const bucket: string | null = input.report.storageBucket;
    const prefix: string | null = input.report.storageBundlePrefix;
    const manifestKey: string | null = input.report.storageManifestKey;
    if (
      bucket === null ||
      prefix === null ||
      manifestKey === null ||
      this.reportStorage.s3Client === undefined
    ) {
      return null;
    }
    const manifest = await loadBundleManifestFromS3({
      s3Client: this.reportStorage.s3Client,
      bucketName: bucket,
      manifestKey,
    });
    return presignBundleAssetUrls({
      s3Client: this.reportStorage.s3Client,
      bucketName: bucket,
      bundlePrefix: prefix,
      manifest,
    });
  }

  private async generateReportMarkdown(input: {
    readonly userId: string;
    readonly type: AnalysisType;
    readonly summary: string;
    readonly username: string;
    readonly createdAtIso: string;
    readonly parameters: Record<string, unknown>;
    readonly now: Date;
  }): Promise<{
    readonly markdownBody: string;
    readonly technicalPayload: TechnicalAnalysisComputationPayload | undefined;
    readonly technicalChartContext: TechnicalAnalysisBundleChartContext | undefined;
  }> {
    if (input.type !== 'technical-analysis' && input.type !== 'portfolio-builder') {
      const markdownBody: string = buildMarkdownReport({
        type: input.type,
        summary: input.summary,
        username: input.username,
        createdAtIso: input.createdAtIso,
        parameters: input.parameters,
      });
      return { markdownBody, technicalPayload: undefined, technicalChartContext: undefined };
    }
    let technicalPayload: TechnicalAnalysisComputationPayload | undefined;
    let technicalChartContext: TechnicalAnalysisBundleChartContext | undefined;
    let prompt: string;
    if (input.type === 'technical-analysis') {
      const ctx = await prepareTechnicalAnalysisLlmContext({
        parameters: input.parameters,
        now: input.now,
        log: this.log,
      });
      technicalPayload = ctx.technicalPayload;
      technicalChartContext = ctx.technicalChartContext;
      prompt = ctx.prompt;
    } else {
      prompt = buildPortfolioBuilderPrompt({
        input: parsePortfolioBuilderInput({ parameters: input.parameters }),
      });
    }
    const userCredentials = await tryResolveUserAiCredentials({
      userAiSettingsRepository: this.userAiSettingsRepository,
      userId: input.userId,
    });
    if (userCredentials === undefined) {
      throw new Error('AI credentials are not configured. Please set your Anthropic API key in Settings.');
    }
    const systemPrompt: string =
      input.type === 'technical-analysis' ? TECHNICAL_ANALYSIS_SYSTEM_PROMPT : PORTFOLIO_BUILDER_SYSTEM_PROMPT;
    const reportMarkdown: string = await requestAnthropicRecommendationJson({
      apiKey: userCredentials.apiKey,
      model: userCredentials.modelId,
      system: systemPrompt,
      user: prompt,
    });
    if (reportMarkdown.trim().length === 0) {
      if (input.type === 'technical-analysis') {
        throw new Error('AI response was empty for technical analysis.');
      }
      throw new Error('AI response was empty for portfolio builder.');
    }
    return { markdownBody: reportMarkdown.trim(), technicalPayload, technicalChartContext };
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

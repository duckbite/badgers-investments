import { randomUUID } from 'crypto';
import type { AssetRepository } from '../assets/asset-repository.js';
import type { AssetRecord } from '../assets/asset-repository.js';
import { tryResolveUserAiCredentials } from '../ai/resolve-user-ai-credentials.js';
import type { UserAiSettingsRepository } from '../ai/user-ai-settings-repository.js';
import type { TransactionRecord } from '../ledger/transaction-repository.js';
import { TransactionRepository } from '../ledger/transaction-repository.js';
import type { PortfolioConfigService } from '../portfolio/portfolio-config-service.js';
import type { PortfolioService } from '../portfolio/portfolio-service.js';
import type { PerformanceSnapshotRepository } from '../snapshots/performance-snapshot-repository.js';
import type { PortfolioSnapshotRepository } from '../snapshots/portfolio-snapshot-repository.js';
import type { PositionSnapshotRepository } from '../snapshots/position-snapshot-repository.js';
import type { SnapshotRebuildService } from '../snapshots/snapshot-rebuild-service.js';
import type { PriceSnapshotRepository } from '../valuations/price-snapshot-repository.js';
import { parseAndValidateAiRecommendationJson } from './ai-recommendation-output.js';
import type { AiItemOutput, AiRecommendationOutputValidated } from './ai-recommendation-output.js';
import { buildDeterministicRecommendations } from './baseline-deterministic-recommendations.js';
import { buildRecommendationAnalyticsPayload } from './build-recommendation-analytics-payload.js';
import { evaluateRecommendationRules } from './evaluate-recommendation-rules.js';
import { requestRecommendationLlmJson } from './llm-recommendation-client.js';
import { AI_PROMPT_VERSION, DEDUPE_ENGINE_VERSION, RULE_SET_VERSION } from './recommendation-engine-constants.js';
import { ANALYTICS_SCHEMA_VERSION } from './recommendation-engine-constants.js';
import { computeRecommendationAnalyticsInputHash } from './recommendation-input-hash.js';
import {
  RecommendationRunRepository,
  ruleFindingsToRecords,
  type RecommendationItemRecord,
} from './recommendation-run-repository.js';

export type RecommendationPreconditionError = {
  readonly code: string;
  readonly message: string;
};

export type RecommendationRunSummaryDto = {
  readonly runId: string;
  readonly portfolioId: string;
  readonly runStatus: string;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly analyticsInputHash: string;
  readonly synthesisSource: 'AI' | 'DETERMINISTIC';
  readonly aiStatus: 'OK' | 'FAILED' | 'SKIPPED';
  /** Present when `aiStatus` is FAILED (provider error, HTTP failure, or JSON validation). */
  readonly aiError: string | null;
  /** Provider used for the attempt when credentials were resolved (MVP: ANTHROPIC). */
  readonly aiProvider: string | null;
  readonly aiModel: string | null;
  readonly portfolioLevelSummary: string;
};

export type RecommendationRunDetailDto = RecommendationRunSummaryDto & {
  readonly findings: readonly {
    readonly findingId: string;
    readonly ruleCode: string;
    readonly severity: string;
    readonly scope: string;
    readonly assetId: string | null;
    readonly message: string;
    readonly metrics: unknown;
  }[];
  readonly items: readonly {
    readonly itemId: string;
    readonly priorityRank: number;
    readonly scopeType: string;
    readonly assetId: string | null;
    readonly recommendationType: string;
    readonly headline: string;
    readonly rationale: string;
    readonly assumptions: string | null;
    readonly strengthScore: string;
    readonly confidenceScore: string;
    readonly reasonCodes: readonly string[];
    readonly source: 'AI' | 'DETERMINISTIC';
  }[];
};

function countAdjustmentsLast30Days(input: { readonly transactions: readonly TransactionRecord[]; readonly now: Date }): number {
  const cutMs: number = input.now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const cutYmd: string = new Date(cutMs).toISOString().slice(0, 10);
  return input.transactions.filter(
    (r) => !r.isDeleted && r.transactionType === 'ADJUSTMENT' && r.tradeDate >= cutYmd,
  ).length;
}

function buildDeterministicPortfolioAssumptions(input: {
  readonly attemptedAi: boolean;
  readonly aiStatus: 'OK' | 'FAILED' | 'SKIPPED';
  readonly aiError: string | null;
}): string {
  const base: string = 'Deterministic baseline (rules + scoring).';
  if (!input.attemptedAi) {
    return `${base} AI was not used: add a provider API key under Settings → AI, and ensure this API process has API_AI_SETTINGS_SECRET set (same value as when the key was saved) so the server can decrypt it.`;
  }
  if (input.aiStatus === 'FAILED') {
    const detail: string =
      input.aiError !== null && input.aiError.trim().length > 0 ? input.aiError.trim() : 'Request or validation failed.';
    return `${base} AI did not produce usable output: ${detail}`;
  }
  return base;
}

function normaliseAiItems(input: { readonly ai: AiRecommendationOutputValidated }): readonly AiItemOutput[] {
  const hasPortfolio: boolean = input.ai.items.some((i) => i.scope_type === 'PORTFOLIO');
  if (hasPortfolio) {
    return input.ai.items;
  }
  const ps = input.ai.portfolio_summary;
  const head: AiItemOutput = {
    scope_type: 'PORTFOLIO',
    asset_id: null,
    recommendation_type: ps.recommendation_type,
    headline: ps.headline,
    rationale: ps.rationale,
    assumptions: ps.assumptions,
    strength_score: ps.strength_score,
    confidence_score: ps.confidence_score,
    reason_codes: [],
  };
  return [head, ...input.ai.items];
}

export class RecommendationRunService {
  private readonly portfolioService: PortfolioService;
  private readonly portfolioConfigService: PortfolioConfigService;
  private readonly assetRepository: AssetRepository;
  private readonly transactionRepository: TransactionRepository;
  private readonly portfolioSnapshotRepository: PortfolioSnapshotRepository;
  private readonly positionSnapshotRepository: PositionSnapshotRepository;
  private readonly performanceSnapshotRepository: PerformanceSnapshotRepository;
  private readonly priceSnapshotRepository: PriceSnapshotRepository;
  private readonly snapshotRebuildService: SnapshotRebuildService;
  private readonly recommendationRunRepository: RecommendationRunRepository;
  private readonly userAiSettingsRepository: UserAiSettingsRepository;

  public constructor(input: {
    readonly portfolioService: PortfolioService;
    readonly portfolioConfigService: PortfolioConfigService;
    readonly assetRepository: AssetRepository;
    readonly transactionRepository: TransactionRepository;
    readonly portfolioSnapshotRepository: PortfolioSnapshotRepository;
    readonly positionSnapshotRepository: PositionSnapshotRepository;
    readonly performanceSnapshotRepository: PerformanceSnapshotRepository;
    readonly priceSnapshotRepository: PriceSnapshotRepository;
    readonly snapshotRebuildService: SnapshotRebuildService;
    readonly recommendationRunRepository: RecommendationRunRepository;
    readonly userAiSettingsRepository: UserAiSettingsRepository;
  }) {
    this.portfolioService = input.portfolioService;
    this.portfolioConfigService = input.portfolioConfigService;
    this.assetRepository = input.assetRepository;
    this.transactionRepository = input.transactionRepository;
    this.portfolioSnapshotRepository = input.portfolioSnapshotRepository;
    this.positionSnapshotRepository = input.positionSnapshotRepository;
    this.performanceSnapshotRepository = input.performanceSnapshotRepository;
    this.priceSnapshotRepository = input.priceSnapshotRepository;
    this.snapshotRebuildService = input.snapshotRebuildService;
    this.recommendationRunRepository = input.recommendationRunRepository;
    this.userAiSettingsRepository = input.userAiSettingsRepository;
  }

  public async executeManualRun(input: {
    readonly userId: string;
    readonly now: Date;
    /** When true, do not return an existing completed run with the same analytics hash (always execute a new run). */
    readonly force?: boolean;
  }): Promise<
    | { readonly ok: true; readonly deduped: true; readonly run: RecommendationRunSummaryDto }
    | { readonly ok: true; readonly deduped: false; readonly run: RecommendationRunSummaryDto }
    | { readonly ok: false; readonly error: RecommendationPreconditionError }
  > {
    const portfolioId: string = await this.portfolioService.requirePortfolioIdForUser({ userId: input.userId, now: input.now });
    const config = await this.portfolioConfigService.getActiveForUser({ userId: input.userId, now: input.now });
    const assets: readonly AssetRecord[] = await this.assetRepository.listByPortfolio({ userId: input.userId, portfolioId });
    const activeAssets: readonly AssetRecord[] = assets.filter((a) => a.isActive);
    if (activeAssets.length === 0) {
      return { ok: false, error: { code: 'REC_PRECONDITION_NO_ASSETS', message: 'At least one active asset is required.' } };
    }
    const transactions: readonly TransactionRecord[] = await this.transactionRepository.listByPortfolio({
      userId: input.userId,
      portfolioId,
    });
    const nonDeletedTx: readonly TransactionRecord[] = transactions.filter((t) => !t.isDeleted);
    let portfolioSnap = await this.portfolioSnapshotRepository.getLatest({ userId: input.userId, portfolioId });
    if (portfolioSnap === undefined && nonDeletedTx.length === 0) {
      return {
        ok: false,
        error: {
          code: 'REC_PRECONDITION_NO_LEDGER',
          message: 'Enter at least one transaction (or rebuild snapshots) before running recommendations.',
        },
      };
    }
    if (portfolioSnap === undefined) {
      await this.snapshotRebuildService.rebuild({ userId: input.userId, now: input.now, throughDate: undefined });
      portfolioSnap = await this.portfolioSnapshotRepository.getLatest({ userId: input.userId, portfolioId });
    }
    if (portfolioSnap === undefined) {
      return { ok: false, error: { code: 'REC_NO_SNAPSHOT', message: 'Portfolio snapshot is unavailable after rebuild.' } };
    }
    const snapshotDate: string = portfolioSnap.snapshotDate;
    const positions = await this.positionSnapshotRepository.listForSnapshotDate({
      userId: input.userId,
      portfolioId,
      snapshotDate,
    });
    const performanceRows = await this.performanceSnapshotRepository.listAllAscending({ userId: input.userId, portfolioId });
    const assetsById: Map<string, AssetRecord> = new Map(activeAssets.map((a) => [a.assetId, a]));
    const priceResolve = async (assetId: string) =>
      this.priceSnapshotRepository.findLatestForAssetOnOrBeforeDate({
        userId: input.userId,
        portfolioId,
        assetId,
        onOrBeforeDate: snapshotDate,
      });
    const payload = await buildRecommendationAnalyticsPayload({
      portfolioId,
      snapshotDate,
      portfolioSnapshot: portfolioSnap,
      positionRows: positions,
      performanceRows,
      assetsById,
      config,
      priceResolve,
    });
    const adjustmentCount = countAdjustmentsLast30Days({ transactions, now: input.now });
    const findings = evaluateRecommendationRules({ payload, adjustmentCountLast30Days: adjustmentCount, assetsById });
    const baseline = buildDeterministicRecommendations({ payload, findings });
    const analyticsHash = computeRecommendationAnalyticsInputHash({
      configVersionId: config.configVersionId,
      analyticsPayload: payload,
    });
    const force: boolean = input.force === true;
    if (!force) {
      const existing = await this.recommendationRunRepository.findLatestCompletedWithHash({
        userId: input.userId,
        portfolioId,
        analyticsInputHash: analyticsHash,
        configVersionId: config.configVersionId,
        dedupeEngineVersion: DEDUPE_ENGINE_VERSION,
        scanLimit: 80,
      });
      if (existing !== undefined) {
        return {
          ok: true,
          deduped: true,
          run: toSummaryDto({ record: existing }),
        };
      }
    }
    const runId: string = randomUUID();
    const startedAtIso: string = input.now.toISOString();
    const credentials = await tryResolveUserAiCredentials({
      userAiSettingsRepository: this.userAiSettingsRepository,
      userId: input.userId,
    });
    let synthesisSource: 'AI' | 'DETERMINISTIC' = 'DETERMINISTIC';
    let aiStatus: 'OK' | 'FAILED' | 'SKIPPED' = 'SKIPPED';
    let aiError: string | null = null;
    let aiOutputJson: string | null = null;
    let aiProvider: string | null = null;
    let aiModel: string | null = null;
    let itemsToPersist: RecommendationItemRecord[] = [];
    let portfolioLevelSummary: string = baseline.portfolio_summary.headline;
    if (credentials !== undefined) {
      aiProvider = credentials.provider;
      aiModel = credentials.modelId;
      aiStatus = 'FAILED';
      synthesisSource = 'DETERMINISTIC';
      try {
        const raw: string = await requestRecommendationLlmJson({
          apiKey: credentials.apiKey,
          model: credentials.modelId,
          payload,
          findings,
          baseline,
        });
        const validated = parseAndValidateAiRecommendationJson({ rawText: raw, payload });
        if (!validated.ok) {
          aiError = validated.message;
        } else {
          aiOutputJson = JSON.stringify(validated.value);
          const mergedItems = normaliseAiItems({ ai: validated.value });
          itemsToPersist = mergedItems.map((it, index) => ({
            runId,
            itemId: randomUUID(),
            priorityRank: index,
            scopeType: it.scope_type,
            assetId: it.asset_id,
            recommendationType: it.recommendation_type,
            headline: it.headline,
            rationale: it.rationale,
            assumptions: it.assumptions,
            strengthScore: String(it.strength_score),
            confidenceScore: String(it.confidence_score),
            reasonCodesJson: JSON.stringify([...it.reason_codes]),
            source: 'AI',
          }));
          portfolioLevelSummary = validated.value.portfolio_summary.headline;
          synthesisSource = 'AI';
          aiStatus = 'OK';
          aiError = null;
        }
      } catch (err) {
        aiError = err instanceof Error ? err.message : 'AI request failed.';
      }
    }
    if (synthesisSource === 'DETERMINISTIC') {
      const attemptedAi: boolean = credentials !== undefined;
      const deterministicLines: RecommendationItemRecord[] = [];
      deterministicLines.push({
        runId,
        itemId: randomUUID(),
        priorityRank: 0,
        scopeType: 'PORTFOLIO',
        assetId: null,
        recommendationType: baseline.portfolio_summary.recommendation_type,
        headline: baseline.portfolio_summary.headline,
        rationale: baseline.portfolio_summary.rationale,
        assumptions: buildDeterministicPortfolioAssumptions({ attemptedAi, aiStatus, aiError }),
        strengthScore: String(baseline.portfolio_summary.strength_score),
        confidenceScore: String(baseline.portfolio_summary.confidence_score),
        reasonCodesJson: JSON.stringify([]),
        source: 'DETERMINISTIC',
      });
      baseline.items.forEach((it, index) => {
        deterministicLines.push({
          runId,
          itemId: randomUUID(),
          priorityRank: index + 1,
          scopeType: it.scope_type,
          assetId: it.asset_id,
          recommendationType: it.recommendation_type,
          headline: it.headline,
          rationale: it.rationale,
          assumptions: 'Deterministic baseline.',
          strengthScore: String(it.strength_score),
          confidenceScore: String(it.confidence_score),
          reasonCodesJson: JSON.stringify([...it.reason_codes]),
          source: 'DETERMINISTIC',
        });
      });
      itemsToPersist = deterministicLines;
      portfolioLevelSummary = baseline.portfolio_summary.headline;
    }
    const completedAtIso: string = input.now.toISOString();
    const header = {
      runId,
      portfolioId,
      configVersionId: config.configVersionId,
      runTriggerType: 'MANUAL',
      runStatus: 'COMPLETED',
      startedAtIso,
      completedAtIso,
      analyticsInputHash: analyticsHash,
      analyticsSchemaVersion: ANALYTICS_SCHEMA_VERSION,
      ruleSetVersion: RULE_SET_VERSION,
      dedupeEngineVersion: DEDUPE_ENGINE_VERSION,
      promptVersion: AI_PROMPT_VERSION,
      analyticsPayloadJson: JSON.stringify(payload),
      baselineJson: JSON.stringify(baseline),
      synthesisSource,
      aiProvider,
      aiModel,
      aiStatus,
      aiError,
      aiOutputJson,
      portfolioLevelSummary,
    };
    await this.recommendationRunRepository.putRunHeader({ userId: input.userId, record: header });
    const findingRecords = ruleFindingsToRecords({ runId, findings });
    for (const fr of findingRecords) {
      await this.recommendationRunRepository.putFinding({ userId: input.userId, portfolioId, record: fr });
    }
    for (const item of itemsToPersist) {
      await this.recommendationRunRepository.putItem({ userId: input.userId, portfolioId, record: item });
    }
    const persisted = await this.recommendationRunRepository.getRunById({ userId: input.userId, portfolioId, runId });
    if (persisted === undefined) {
      throw new Error('Recommendation run persistence failed.');
    }
    return { ok: true, deduped: false, run: toSummaryDto({ record: persisted }) };
  }

  public async listRuns(input: { readonly userId: string; readonly now: Date; readonly limit: number }): Promise<readonly RecommendationRunSummaryDto[]> {
    const portfolioId: string = await this.portfolioService.requirePortfolioIdForUser({ userId: input.userId, now: input.now });
    const rows = await this.recommendationRunRepository.listRecentRuns({
      userId: input.userId,
      portfolioId,
      limit: input.limit,
    });
    return rows.map((r) => toSummaryDto({ record: r }));
  }

  public async getRunDetail(input: {
    readonly userId: string;
    readonly now: Date;
    readonly runId: string;
  }): Promise<RecommendationRunDetailDto | undefined> {
    const portfolioId: string = await this.portfolioService.requirePortfolioIdForUser({ userId: input.userId, now: input.now });
    const header = await this.recommendationRunRepository.getRunById({
      userId: input.userId,
      portfolioId,
      runId: input.runId,
    });
    if (header === undefined) {
      return undefined;
    }
    const findings = await this.recommendationRunRepository.listFindingsForRun({
      userId: input.userId,
      portfolioId,
      runId: input.runId,
    });
    const items = await this.recommendationRunRepository.listItemsForRun({
      userId: input.userId,
      portfolioId,
      runId: input.runId,
    });
    return {
      ...toSummaryDto({ record: header }),
      findings: findings.map((f) => ({
        findingId: f.findingId,
        ruleCode: f.ruleCode,
        severity: f.severity,
        scope: f.scope,
        assetId: f.assetId,
        message: f.message,
        metrics: safeJsonParse({ raw: f.metricsJson }),
      })),
      items: items.map((it) => ({
        itemId: it.itemId,
        priorityRank: it.priorityRank,
        scopeType: it.scopeType,
        assetId: it.assetId,
        recommendationType: it.recommendationType,
        headline: it.headline,
        rationale: it.rationale,
        assumptions: it.assumptions,
        strengthScore: it.strengthScore,
        confidenceScore: it.confidenceScore,
        reasonCodes: safeJsonStringArray({ raw: it.reasonCodesJson }),
        source: it.source,
      })),
    };
  }
}

function toSummaryDto(input: {
  readonly record: {
    readonly runId: string;
    readonly portfolioId: string;
    readonly runStatus: string;
    readonly startedAtIso: string;
    readonly completedAtIso: string | null;
    readonly analyticsInputHash: string;
    readonly synthesisSource: 'AI' | 'DETERMINISTIC';
    readonly aiStatus: 'OK' | 'FAILED' | 'SKIPPED';
    readonly aiError: string | null;
    readonly aiProvider: string | null;
    readonly aiModel: string | null;
    readonly portfolioLevelSummary: string;
  };
}): RecommendationRunSummaryDto {
  return {
    runId: input.record.runId,
    portfolioId: input.record.portfolioId,
    runStatus: input.record.runStatus,
    startedAt: input.record.startedAtIso,
    completedAt: input.record.completedAtIso,
    analyticsInputHash: input.record.analyticsInputHash,
    synthesisSource: input.record.synthesisSource,
    aiStatus: input.record.aiStatus,
    aiError: input.record.aiError,
    aiProvider: input.record.aiProvider,
    aiModel: input.record.aiModel,
    portfolioLevelSummary: input.record.portfolioLevelSummary,
  };
}

function safeJsonParse(input: { readonly raw: string }): unknown {
  try {
    return JSON.parse(input.raw) as unknown;
  } catch {
    return null;
  }
}

function safeJsonStringArray(input: { readonly raw: string }): readonly string[] {
  try {
    const v: unknown = JSON.parse(input.raw);
    if (!Array.isArray(v)) {
      return [];
    }
    return v.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

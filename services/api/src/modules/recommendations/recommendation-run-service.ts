import { randomUUID } from 'crypto';
import type { AssetRepository } from '../assets/asset-repository.js';
import type { AssetRecord } from '../assets/asset-repository.js';
import { tryResolveUserAiCredentials } from '../ai/resolve-user-ai-credentials.js';
import type { UserAiSettingsRepository } from '../ai/user-ai-settings-repository.js';
import type { TransactionRecord } from '../ledger/transaction-repository.js';
import { TransactionRepository } from '../ledger/transaction-repository.js';
import type { PortfolioConfigFullDto } from '../portfolio/portfolio-config-service.js';
import type { PortfolioConfigService } from '../portfolio/portfolio-config-service.js';
import type { PortfolioService } from '../portfolio/portfolio-service.js';
import type { PerformanceSnapshotRepository } from '../snapshots/performance-snapshot-repository.js';
import type { PortfolioSnapshotRepository } from '../snapshots/portfolio-snapshot-repository.js';
import type { PositionSnapshotRepository } from '../snapshots/position-snapshot-repository.js';
import type { SnapshotRebuildService } from '../snapshots/snapshot-rebuild-service.js';
import type { PriceSnapshotRepository } from '../valuations/price-snapshot-repository.js';
import { parseAndValidateAiRecommendationJson } from './ai-recommendation-output.js';
import type { AiItemOutput, AiRecommendationOutputValidated } from './ai-recommendation-output.js';
import type { BaselineRecommendationResult } from './baseline-deterministic-recommendations.js';
import { buildDeterministicRecommendations } from './baseline-deterministic-recommendations.js';
import { buildRecommendationAnalyticsPayload } from './build-recommendation-analytics-payload.js';
import type { RecommendationAnalyticsPayload } from './recommendation-analytics-payload-types.js';
import { evaluateRecommendationRules } from './evaluate-recommendation-rules.js';
import { RecommendationJobQueueRepository } from './recommendation-job-queue-repository.js';
import type { RuleFinding } from './recommendation-rule-types.js';
import { requestRecommendationLlmJson } from './llm-recommendation-client.js';
import { AI_PROMPT_VERSION, DEDUPE_ENGINE_VERSION, RULE_SET_VERSION } from './recommendation-engine-constants.js';
import { ANALYTICS_SCHEMA_VERSION } from './recommendation-engine-constants.js';
import { computeRecommendationAnalyticsInputHash } from './recommendation-input-hash.js';
import {
  RecommendationRunRepository,
  ruleFindingsToRecords,
  type RecommendationItemRecord,
  type RecommendationRunHeaderRecord,
} from './recommendation-run-repository.js';

const PROCESSING_TIMEOUT_MS: number = 10 * 60 * 1000;

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
  readonly runItemCount: number;
  readonly runActionableCount: number;
  readonly runMaxStrengthScore: string | null;
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

function computeRunAggregateMeta(input: { readonly items: readonly RecommendationItemRecord[] }): {
  readonly runItemCount: number;
  readonly runActionableCount: number;
  readonly runMaxStrengthScore: string | null;
} {
  if (input.items.length === 0) {
    return { runItemCount: 0, runActionableCount: 0, runMaxStrengthScore: null };
  }
  let maxStr: number = Number.NEGATIVE_INFINITY;
  for (const it of input.items) {
    const n: number = Number.parseFloat(it.strengthScore);
    if (!Number.isNaN(n) && n > maxStr) {
      maxStr = n;
    }
  }
  const runActionableCount: number = input.items.filter(
    (it) => it.recommendationType === 'BUY' || it.recommendationType === 'SELL',
  ).length;
  return {
    runItemCount: input.items.length,
    runActionableCount,
    runMaxStrengthScore: maxStr === Number.NEGATIVE_INFINITY ? null : String(maxStr),
  };
}

function parseRuleFindingsJson(raw: string | null): readonly RuleFinding[] {
  if (raw === null || raw.trim().length === 0) {
    return [];
  }
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? (v as RuleFinding[]) : [];
  } catch {
    return [];
  }
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

type ManualRunContextOk = {
  readonly portfolioId: string;
  readonly config: PortfolioConfigFullDto;
  readonly payload: RecommendationAnalyticsPayload;
  readonly findings: readonly RuleFinding[];
  readonly baseline: BaselineRecommendationResult;
  readonly analyticsHash: string;
};

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
  private readonly recommendationJobQueueRepository: RecommendationJobQueueRepository;
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
    readonly recommendationJobQueueRepository: RecommendationJobQueueRepository;
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
    this.recommendationJobQueueRepository = input.recommendationJobQueueRepository;
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
    const loaded = await this.loadManualRunContext({ userId: input.userId, now: input.now });
    if (!loaded.ok) {
      return loaded;
    }
    const { portfolioId, config, payload, findings, baseline, analyticsHash } = loaded.context;
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
    const enqueuedAtIso: string = startedAtIso;
    const processingHeader: RecommendationRunHeaderRecord = {
      runId,
      portfolioId,
      configVersionId: config.configVersionId,
      runTriggerType: 'MANUAL',
      runStatus: 'PROCESSING',
      startedAtIso,
      completedAtIso: null,
      analyticsInputHash: analyticsHash,
      analyticsSchemaVersion: ANALYTICS_SCHEMA_VERSION,
      ruleSetVersion: RULE_SET_VERSION,
      dedupeEngineVersion: DEDUPE_ENGINE_VERSION,
      promptVersion: AI_PROMPT_VERSION,
      analyticsPayloadJson: JSON.stringify(payload),
      baselineJson: JSON.stringify(baseline),
      synthesisSource: 'DETERMINISTIC',
      aiProvider: null,
      aiModel: null,
      aiStatus: 'SKIPPED',
      aiError: null,
      aiOutputJson: null,
      portfolioLevelSummary: 'Generating portfolio insights…',
      ruleFindingsJson: JSON.stringify([...findings]),
      runItemCount: 0,
      runActionableCount: 0,
      runMaxStrengthScore: null,
    };
    await this.recommendationRunRepository.putRunHeader({ userId: input.userId, record: processingHeader });
    await this.recommendationJobQueueRepository.enqueue({
      record: { userId: input.userId, portfolioId, runId, enqueuedAtIso },
    });
    const persisted = await this.recommendationRunRepository.getRunById({ userId: input.userId, portfolioId, runId });
    if (persisted === undefined) {
      throw new Error('Recommendation run persistence failed.');
    }
    return { ok: true, deduped: false, run: toSummaryDto({ record: persisted }) };
  }

  private async loadManualRunContext(input: {
    readonly userId: string;
    readonly now: Date;
  }): Promise<
    | { readonly ok: true; readonly context: ManualRunContextOk }
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
    return {
      ok: true,
      context: { portfolioId, config, payload, findings, baseline, analyticsHash },
    };
  }

  /**
   * Worker entry: load a queued job’s snapshot, run AI / deterministic synthesis, persist items, then remove the queue row.
   */
  public async completeQueuedRecommendationJob(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly runId: string;
    readonly enqueuedAtIso: string;
    readonly now: Date;
  }): Promise<void> {
    const deleteJob = async (): Promise<void> => {
      await this.recommendationJobQueueRepository.deleteJob({
        enqueuedAtIso: input.enqueuedAtIso,
        runId: input.runId,
      });
    };
    const header = await this.recommendationRunRepository.getRunById({
      userId: input.userId,
      portfolioId: input.portfolioId,
      runId: input.runId,
    });
    if (header === undefined) {
      await deleteJob();
      return;
    }
    if (header.runStatus !== 'PROCESSING') {
      await deleteJob();
      return;
    }
    let payload: RecommendationAnalyticsPayload;
    let baseline: BaselineRecommendationResult;
    try {
      payload = JSON.parse(header.analyticsPayloadJson) as RecommendationAnalyticsPayload;
      baseline = JSON.parse(header.baselineJson) as BaselineRecommendationResult;
    } catch {
      await this.markRunFailed({
        userId: input.userId,
        portfolioId: input.portfolioId,
        header,
        message: 'Stored analytics payload is invalid.',
        now: input.now,
      });
      await deleteJob();
      return;
    }
    const findings = parseRuleFindingsJson(header.ruleFindingsJson);
    try {
      await this.synthesizeAndPersistCompletedRun({
        userId: input.userId,
        portfolioId: input.portfolioId,
        runId: input.runId,
        now: input.now,
        processingHeader: header,
        payload,
        findings,
        baseline,
      });
    } catch (err) {
      const message: string = err instanceof Error ? err.message : 'Recommendation run failed.';
      await this.markRunFailed({ userId: input.userId, portfolioId: input.portfolioId, header, message, now: input.now });
    }
    await deleteJob();
  }

  public async processRecommendationJobQueue(input: { readonly now: Date; readonly maxJobs: number }): Promise<number> {
    const jobs = await this.recommendationJobQueueRepository.listOldest({ limit: input.maxJobs });
    for (const job of jobs) {
      await this.completeQueuedRecommendationJob({
        userId: job.userId,
        portfolioId: job.portfolioId,
        runId: job.runId,
        enqueuedAtIso: job.enqueuedAtIso,
        now: input.now,
      });
    }
    return jobs.length;
  }

  private async markRunFailed(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly header: RecommendationRunHeaderRecord;
    readonly message: string;
    readonly now: Date;
  }): Promise<void> {
    const failedHeader: RecommendationRunHeaderRecord = {
      ...input.header,
      runStatus: 'FAILED',
      completedAtIso: input.now.toISOString(),
      portfolioLevelSummary: 'This run could not be completed.',
      synthesisSource: 'DETERMINISTIC',
      aiProvider: null,
      aiModel: null,
      aiStatus: 'SKIPPED',
      aiError: input.message,
      aiOutputJson: null,
      ruleFindingsJson: null,
      runItemCount: 0,
      runActionableCount: 0,
      runMaxStrengthScore: null,
    };
    await this.recommendationRunRepository.putRunHeader({ userId: input.userId, record: failedHeader });
  }

  private async markRunTimeout(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly header: RecommendationRunHeaderRecord;
    readonly now: Date;
  }): Promise<void> {
    const timedOutHeader: RecommendationRunHeaderRecord = {
      ...input.header,
      runStatus: 'TIMEOUT',
      completedAtIso: input.now.toISOString(),
      portfolioLevelSummary: 'Run timed out after 10 minutes.',
      synthesisSource: 'DETERMINISTIC',
      aiProvider: null,
      aiModel: null,
      aiStatus: 'SKIPPED',
      aiError: 'Run timed out after 10 minutes.',
      aiOutputJson: null,
      ruleFindingsJson: null,
      runItemCount: 0,
      runActionableCount: 0,
      runMaxStrengthScore: null,
    };
    await this.recommendationRunRepository.putRunHeader({ userId: input.userId, record: timedOutHeader });
    await this.recommendationJobQueueRepository.deleteByRunId({ runId: input.header.runId });
  }

  private async synthesizeAndPersistCompletedRun(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly runId: string;
    readonly now: Date;
    readonly processingHeader: RecommendationRunHeaderRecord;
    readonly payload: RecommendationAnalyticsPayload;
    readonly findings: readonly RuleFinding[];
    readonly baseline: BaselineRecommendationResult;
  }): Promise<void> {
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
    let portfolioLevelSummary: string = input.baseline.portfolio_summary.headline;
    if (credentials !== undefined) {
      aiProvider = credentials.provider;
      aiModel = credentials.modelId;
      aiStatus = 'FAILED';
      synthesisSource = 'DETERMINISTIC';
      try {
        const raw: string = await requestRecommendationLlmJson({
          apiKey: credentials.apiKey,
          model: credentials.modelId,
          payload: input.payload,
          findings: input.findings,
          baseline: input.baseline,
        });
        const validated = parseAndValidateAiRecommendationJson({ rawText: raw, payload: input.payload });
        if (!validated.ok) {
          aiError = validated.message;
        } else {
          aiOutputJson = JSON.stringify(validated.value);
          const mergedItems = normaliseAiItems({ ai: validated.value });
          itemsToPersist = mergedItems.map((it, index) => ({
            runId: input.runId,
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
        runId: input.runId,
        itemId: randomUUID(),
        priorityRank: 0,
        scopeType: 'PORTFOLIO',
        assetId: null,
        recommendationType: input.baseline.portfolio_summary.recommendation_type,
        headline: input.baseline.portfolio_summary.headline,
        rationale: input.baseline.portfolio_summary.rationale,
        assumptions: buildDeterministicPortfolioAssumptions({ attemptedAi, aiStatus, aiError }),
        strengthScore: String(input.baseline.portfolio_summary.strength_score),
        confidenceScore: String(input.baseline.portfolio_summary.confidence_score),
        reasonCodesJson: JSON.stringify([]),
        source: 'DETERMINISTIC',
      });
      input.baseline.items.forEach((it, index) => {
        deterministicLines.push({
          runId: input.runId,
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
      portfolioLevelSummary = input.baseline.portfolio_summary.headline;
    }
    const agg = computeRunAggregateMeta({ items: itemsToPersist });
    const completedHeader: RecommendationRunHeaderRecord = {
      runId: input.runId,
      portfolioId: input.portfolioId,
      configVersionId: input.processingHeader.configVersionId,
      runTriggerType: input.processingHeader.runTriggerType,
      runStatus: 'COMPLETED',
      startedAtIso: input.processingHeader.startedAtIso,
      completedAtIso: input.now.toISOString(),
      analyticsInputHash: input.processingHeader.analyticsInputHash,
      analyticsSchemaVersion: ANALYTICS_SCHEMA_VERSION,
      ruleSetVersion: RULE_SET_VERSION,
      dedupeEngineVersion: DEDUPE_ENGINE_VERSION,
      promptVersion: AI_PROMPT_VERSION,
      analyticsPayloadJson: input.processingHeader.analyticsPayloadJson,
      baselineJson: input.processingHeader.baselineJson,
      synthesisSource,
      aiProvider,
      aiModel,
      aiStatus,
      aiError,
      aiOutputJson,
      portfolioLevelSummary,
      ruleFindingsJson: null,
      runItemCount: agg.runItemCount,
      runActionableCount: agg.runActionableCount,
      runMaxStrengthScore: agg.runMaxStrengthScore,
    };
    const findingRecords = ruleFindingsToRecords({ runId: input.runId, findings: input.findings });
    for (const fr of findingRecords) {
      await this.recommendationRunRepository.putFinding({ userId: input.userId, portfolioId: input.portfolioId, record: fr });
    }
    for (const item of itemsToPersist) {
      await this.recommendationRunRepository.putItem({ userId: input.userId, portfolioId: input.portfolioId, record: item });
    }
    await this.recommendationRunRepository.putRunHeader({ userId: input.userId, record: completedHeader });
  }

  public async listRuns(input: { readonly userId: string; readonly now: Date; readonly limit: number }): Promise<readonly RecommendationRunSummaryDto[]> {
    const portfolioId: string = await this.portfolioService.requirePortfolioIdForUser({ userId: input.userId, now: input.now });
    await this.timeoutStaleProcessingRuns({ userId: input.userId, portfolioId, now: input.now });
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
    await this.timeoutStaleProcessingRuns({ userId: input.userId, portfolioId, now: input.now });
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

  public async cancelAllRunningRuns(input: {
    readonly userId: string;
    readonly now: Date;
  }): Promise<{ readonly cancelledCount: number }> {
    const portfolioId: string = await this.portfolioService.requirePortfolioIdForUser({ userId: input.userId, now: input.now });
    const rows: readonly RecommendationRunHeaderRecord[] = await this.recommendationRunRepository.listRecentRuns({
      userId: input.userId,
      portfolioId,
      limit: 200,
    });
    const processingRuns: readonly RecommendationRunHeaderRecord[] = rows.filter((row) => row.runStatus === 'PROCESSING');
    for (const row of processingRuns) {
      await this.markRunFailed({
        userId: input.userId,
        portfolioId,
        header: row,
        message: 'Cancelled by user.',
        now: input.now,
      });
      await this.recommendationJobQueueRepository.deleteByRunId({ runId: row.runId });
    }
    return { cancelledCount: processingRuns.length };
  }

  public async cancelRunById(input: {
    readonly userId: string;
    readonly runId: string;
    readonly now: Date;
  }): Promise<{ readonly cancelled: boolean }> {
    const portfolioId: string = await this.portfolioService.requirePortfolioIdForUser({ userId: input.userId, now: input.now });
    const row: RecommendationRunHeaderRecord | undefined = await this.recommendationRunRepository.getRunById({
      userId: input.userId,
      portfolioId,
      runId: input.runId,
    });
    if (row === undefined || row.runStatus !== 'PROCESSING') {
      return { cancelled: false };
    }
    await this.markRunFailed({
      userId: input.userId,
      portfolioId,
      header: row,
      message: 'Cancelled by user.',
      now: input.now,
    });
    await this.recommendationJobQueueRepository.deleteByRunId({ runId: row.runId });
    return { cancelled: true };
  }

  public async deleteTimedOutRuns(input: {
    readonly userId: string;
    readonly now: Date;
  }): Promise<{ readonly deletedCount: number }> {
    const portfolioId: string = await this.portfolioService.requirePortfolioIdForUser({ userId: input.userId, now: input.now });
    const rows: readonly RecommendationRunHeaderRecord[] = await this.recommendationRunRepository.listRecentRuns({
      userId: input.userId,
      portfolioId,
      limit: 200,
    });
    const timedOutRows: readonly RecommendationRunHeaderRecord[] = rows.filter((row) => row.runStatus === 'TIMEOUT');
    for (const row of timedOutRows) {
      await this.recommendationRunRepository.deleteRunArtifacts({
        userId: input.userId,
        portfolioId,
        runId: row.runId,
      });
      await this.recommendationRunRepository.deleteRunHeader({
        userId: input.userId,
        portfolioId,
        startedAtIso: row.startedAtIso,
        runId: row.runId,
      });
      await this.recommendationJobQueueRepository.deleteByRunId({ runId: row.runId });
    }
    return { deletedCount: timedOutRows.length };
  }

  public async deleteRunById(input: {
    readonly userId: string;
    readonly runId: string;
    readonly now: Date;
  }): Promise<{ readonly deleted: boolean }> {
    const portfolioId: string = await this.portfolioService.requirePortfolioIdForUser({ userId: input.userId, now: input.now });
    const row: RecommendationRunHeaderRecord | undefined = await this.recommendationRunRepository.getRunById({
      userId: input.userId,
      portfolioId,
      runId: input.runId,
    });
    if (row === undefined || row.runStatus === 'PROCESSING') {
      return { deleted: false };
    }
    await this.recommendationRunRepository.deleteRunArtifacts({
      userId: input.userId,
      portfolioId,
      runId: row.runId,
    });
    await this.recommendationRunRepository.deleteRunHeader({
      userId: input.userId,
      portfolioId,
      startedAtIso: row.startedAtIso,
      runId: row.runId,
    });
    await this.recommendationJobQueueRepository.deleteByRunId({ runId: row.runId });
    return { deleted: true };
  }

  private async timeoutStaleProcessingRuns(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly now: Date;
  }): Promise<void> {
    const rows: readonly RecommendationRunHeaderRecord[] = await this.recommendationRunRepository.listRecentRuns({
      userId: input.userId,
      portfolioId: input.portfolioId,
      limit: 200,
    });
    for (const row of rows) {
      if (row.runStatus !== 'PROCESSING') {
        continue;
      }
      const startedAtMs: number = Date.parse(row.startedAtIso);
      if (Number.isNaN(startedAtMs)) {
        continue;
      }
      const elapsedMs: number = input.now.getTime() - startedAtMs;
      if (elapsedMs < PROCESSING_TIMEOUT_MS) {
        continue;
      }
      await this.markRunTimeout({
        userId: input.userId,
        portfolioId: input.portfolioId,
        header: row,
        now: input.now,
      });
    }
  }
}

function toSummaryDto(input: { readonly record: RecommendationRunHeaderRecord }): RecommendationRunSummaryDto {
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
    runItemCount: input.record.runItemCount,
    runActionableCount: input.record.runActionableCount,
    runMaxStrengthScore: input.record.runMaxStrengthScore,
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

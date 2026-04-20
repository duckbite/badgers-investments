import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DeleteCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  buildPortfolioScopedPartitionKey,
  buildRecommendationFindingSortKey,
  buildRecommendationItemSortKey,
  buildRecommendationRunSortKey,
  buildRecommendationRunSortKeyPrefix,
} from '../domain/domain-keys.js';
import type { RuleFinding } from './recommendation-rule-types.js';

const PARTITION_KEY: string = 'PK';
const SORT_KEY: string = 'SK';

export type RecommendationRunHeaderRecord = {
  readonly runId: string;
  readonly portfolioId: string;
  readonly configVersionId: string;
  readonly runTriggerType: string;
  readonly runStatus: string;
  readonly startedAtIso: string;
  readonly completedAtIso: string | null;
  readonly analyticsInputHash: string;
  readonly analyticsSchemaVersion: string;
  readonly ruleSetVersion: string;
  readonly dedupeEngineVersion: string;
  readonly promptVersion: string;
  readonly analyticsPayloadJson: string;
  readonly baselineJson: string;
  readonly synthesisSource: 'AI' | 'DETERMINISTIC';
  readonly aiProvider: string | null;
  readonly aiModel: string | null;
  readonly aiStatus: 'OK' | 'FAILED' | 'SKIPPED';
  readonly aiError: string | null;
  readonly aiOutputJson: string | null;
  readonly portfolioLevelSummary: string;
  readonly currentStep: string | null;
  /** Rule findings snapshot for async workers (set while `runStatus` is PROCESSING). */
  readonly ruleFindingsJson: string | null;
  /** Number of recommendation lines persisted for this run (0 while processing). */
  readonly runItemCount: number;
  /** Items with recommendation type BUY or SELL. */
  readonly runActionableCount: number;
  /** Max item strength score for list filtering (null if unknown). */
  readonly runMaxStrengthScore: string | null;
};

export type RecommendationFindingRecord = {
  readonly runId: string;
  readonly findingId: string;
  readonly ruleCode: string;
  readonly severity: string;
  readonly scope: string;
  readonly assetId: string | null;
  readonly message: string;
  readonly metricsJson: string;
};

export type RecommendationItemRecord = {
  readonly runId: string;
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
  readonly reasonCodesJson: string;
  readonly source: 'AI' | 'DETERMINISTIC';
};

export class RecommendationRunRepository {
  private readonly documentClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  public constructor(input: { readonly documentClient: DynamoDBDocumentClient; readonly tableName: string }) {
    this.documentClient = input.documentClient;
    this.tableName = input.tableName;
  }

  public async putRunHeader(input: {
    readonly userId: string;
    readonly record: RecommendationRunHeaderRecord;
  }): Promise<void> {
    await this.documentClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.record.portfolioId }),
          [SORT_KEY]: buildRecommendationRunSortKey({
            startedAtIso: input.record.startedAtIso,
            runId: input.record.runId,
          }),
          entityType: 'RECOMMENDATION_RUN',
          runId: input.record.runId,
          portfolioId: input.record.portfolioId,
          configVersionId: input.record.configVersionId,
          runTriggerType: input.record.runTriggerType,
          runStatus: input.record.runStatus,
          startedAtIso: input.record.startedAtIso,
          completedAtIso: input.record.completedAtIso,
          analyticsInputHash: input.record.analyticsInputHash,
          analyticsSchemaVersion: input.record.analyticsSchemaVersion,
          ruleSetVersion: input.record.ruleSetVersion,
          dedupeEngineVersion: input.record.dedupeEngineVersion,
          promptVersion: input.record.promptVersion,
          analyticsPayloadJson: input.record.analyticsPayloadJson,
          baselineJson: input.record.baselineJson,
          synthesisSource: input.record.synthesisSource,
          aiProvider: input.record.aiProvider,
          aiModel: input.record.aiModel,
          aiStatus: input.record.aiStatus,
          aiError: input.record.aiError,
          aiOutputJson: input.record.aiOutputJson,
          portfolioLevelSummary: input.record.portfolioLevelSummary,
          currentStep: input.record.currentStep,
          ruleFindingsJson: input.record.ruleFindingsJson,
          runItemCount: input.record.runItemCount,
          runActionableCount: input.record.runActionableCount,
          runMaxStrengthScore: input.record.runMaxStrengthScore,
        },
      }),
    );
  }

  public async putFinding(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly record: RecommendationFindingRecord;
  }): Promise<void> {
    await this.documentClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          [SORT_KEY]: buildRecommendationFindingSortKey({ runId: input.record.runId, findingId: input.record.findingId }),
          entityType: 'RULE_FINDING',
          runId: input.record.runId,
          ruleCode: input.record.ruleCode,
          severity: input.record.severity,
          scope: input.record.scope,
          assetId: input.record.assetId,
          message: input.record.message,
          metricsJson: input.record.metricsJson,
        },
      }),
    );
  }

  public async putItem(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly record: RecommendationItemRecord;
  }): Promise<void> {
    await this.documentClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          [SORT_KEY]: buildRecommendationItemSortKey({ runId: input.record.runId, itemId: input.record.itemId }),
          entityType: 'RECOMMENDATION_ITEM',
          runId: input.record.runId,
          priorityRank: input.record.priorityRank,
          scopeType: input.record.scopeType,
          assetId: input.record.assetId,
          recommendationType: input.record.recommendationType,
          headline: input.record.headline,
          rationale: input.record.rationale,
          assumptions: input.record.assumptions,
          strengthScore: input.record.strengthScore,
          confidenceScore: input.record.confidenceScore,
          reasonCodesJson: input.record.reasonCodesJson,
          source: input.record.source,
        },
      }),
    );
  }

  public async listRecentRuns(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly limit: number;
  }): Promise<readonly RecommendationRunHeaderRecord[]> {
    const pk: string = buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId });
    const collected: RecommendationRunHeaderRecord[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const response = await this.documentClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          ExpressionAttributeValues: {
            ':pk': pk,
            ':skPrefix': buildRecommendationRunSortKeyPrefix(),
          },
          ScanIndexForward: false,
          ExclusiveStartKey: startKey,
        }),
      );
      const items: readonly Record<string, unknown>[] = response.Items ?? [];
      for (const item of items) {
        const row: RecommendationRunHeaderRecord | undefined = parseRunHeader({ item });
        if (row !== undefined) {
          collected.push(row);
        }
      }
      startKey = response.LastEvaluatedKey;
    } while (startKey !== undefined && collected.length < input.limit);
    return collected.slice(0, input.limit);
  }

  public async findLatestCompletedWithHash(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly analyticsInputHash: string;
    readonly configVersionId: string;
    readonly dedupeEngineVersion: string;
    readonly scanLimit: number;
  }): Promise<RecommendationRunHeaderRecord | undefined> {
    const recent: readonly RecommendationRunHeaderRecord[] = await this.listRecentRuns({
      userId: input.userId,
      portfolioId: input.portfolioId,
      limit: input.scanLimit,
    });
    for (const row of recent) {
      if (
        row.runStatus === 'COMPLETED' &&
        row.analyticsInputHash === input.analyticsInputHash &&
        row.configVersionId === input.configVersionId &&
        row.dedupeEngineVersion === input.dedupeEngineVersion
      ) {
        return row;
      }
    }
    return undefined;
  }

  public async getRunById(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly runId: string;
  }): Promise<RecommendationRunHeaderRecord | undefined> {
    const recent: readonly RecommendationRunHeaderRecord[] = await this.listRecentRuns({
      userId: input.userId,
      portfolioId: input.portfolioId,
      limit: 200,
    });
    return recent.find((r) => r.runId === input.runId);
  }

  public async listFindingsForRun(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly runId: string;
  }): Promise<readonly RecommendationFindingRecord[]> {
    const pk: string = buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId });
    const prefix: string = `REC_FIND#${input.runId}#`;
    const collected: RecommendationFindingRecord[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const response = await this.documentClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          ExpressionAttributeValues: {
            ':pk': pk,
            ':skPrefix': prefix,
          },
          ConsistentRead: true,
          ExclusiveStartKey: startKey,
        }),
      );
      const items: readonly Record<string, unknown>[] = response.Items ?? [];
      for (const item of items) {
        const row: RecommendationFindingRecord | undefined = parseFinding({ item });
        if (row !== undefined) {
          collected.push(row);
        }
      }
      startKey = response.LastEvaluatedKey;
    } while (startKey !== undefined);
    return collected;
  }

  public async listItemsForRun(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly runId: string;
  }): Promise<readonly RecommendationItemRecord[]> {
    const pk: string = buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId });
    const prefix: string = `REC_ITEM#${input.runId}#`;
    const collected: RecommendationItemRecord[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const response = await this.documentClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          ExpressionAttributeValues: {
            ':pk': pk,
            ':skPrefix': prefix,
          },
          ConsistentRead: true,
          ExclusiveStartKey: startKey,
        }),
      );
      const items: readonly Record<string, unknown>[] = response.Items ?? [];
      for (const item of items) {
        const row: RecommendationItemRecord | undefined = parseItem({ item });
        if (row !== undefined) {
          collected.push(row);
        }
      }
      startKey = response.LastEvaluatedKey;
    } while (startKey !== undefined);
    return collected.sort((a, b) => a.priorityRank - b.priorityRank);
  }

  public async deleteRunHeader(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly startedAtIso: string;
    readonly runId: string;
  }): Promise<void> {
    await this.documentClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
          [SORT_KEY]: buildRecommendationRunSortKey({
            startedAtIso: input.startedAtIso,
            runId: input.runId,
          }),
        },
      }),
    );
  }

  public async deleteRunArtifacts(input: { readonly userId: string; readonly portfolioId: string; readonly runId: string }): Promise<void> {
    const findings: readonly RecommendationFindingRecord[] = await this.listFindingsForRun({
      userId: input.userId,
      portfolioId: input.portfolioId,
      runId: input.runId,
    });
    for (const finding of findings) {
      await this.documentClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
            [SORT_KEY]: buildRecommendationFindingSortKey({
              runId: input.runId,
              findingId: finding.findingId,
            }),
          },
        }),
      );
    }
    const items: readonly RecommendationItemRecord[] = await this.listItemsForRun({
      userId: input.userId,
      portfolioId: input.portfolioId,
      runId: input.runId,
    });
    for (const item of items) {
      await this.documentClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId }),
            [SORT_KEY]: buildRecommendationItemSortKey({
              runId: input.runId,
              itemId: item.itemId,
            }),
          },
        }),
      );
    }
  }
}

function parseRunHeader(input: { readonly item: Record<string, unknown> }): RecommendationRunHeaderRecord | undefined {
  const entityType: unknown = input.item['entityType'];
  if (entityType !== 'RECOMMENDATION_RUN') {
    return undefined;
  }
  const runId: unknown = input.item['runId'];
  const portfolioId: unknown = input.item['portfolioId'];
  const configVersionId: unknown = input.item['configVersionId'];
  const runTriggerType: unknown = input.item['runTriggerType'];
  const runStatus: unknown = input.item['runStatus'];
  const startedAtIso: unknown = input.item['startedAtIso'];
  const analyticsInputHash: unknown = input.item['analyticsInputHash'];
  const analyticsSchemaVersion: unknown = input.item['analyticsSchemaVersion'];
  const ruleSetVersion: unknown = input.item['ruleSetVersion'];
  const dedupeEngineVersion: unknown = input.item['dedupeEngineVersion'];
  const promptVersion: unknown = input.item['promptVersion'];
  const analyticsPayloadJson: unknown = input.item['analyticsPayloadJson'];
  const baselineJson: unknown = input.item['baselineJson'];
  const synthesisSource: unknown = input.item['synthesisSource'];
  const aiProvider: unknown = input.item['aiProvider'];
  const aiModel: unknown = input.item['aiModel'];
  const aiStatus: unknown = input.item['aiStatus'];
  const aiError: unknown = input.item['aiError'];
  const aiOutputJson: unknown = input.item['aiOutputJson'];
  const portfolioLevelSummary: unknown = input.item['portfolioLevelSummary'];
  const currentStep: unknown = input.item['currentStep'];
  const completedAtIso: unknown = input.item['completedAtIso'];
  const ruleFindingsJson: unknown = input.item['ruleFindingsJson'];
  const runItemCount: unknown = input.item['runItemCount'];
  const runActionableCount: unknown = input.item['runActionableCount'];
  const runMaxStrengthScore: unknown = input.item['runMaxStrengthScore'];
  if (
    typeof runId !== 'string' ||
    typeof portfolioId !== 'string' ||
    typeof configVersionId !== 'string' ||
    typeof runTriggerType !== 'string' ||
    typeof runStatus !== 'string' ||
    typeof startedAtIso !== 'string' ||
    typeof analyticsInputHash !== 'string' ||
    typeof analyticsSchemaVersion !== 'string' ||
    typeof ruleSetVersion !== 'string' ||
    typeof dedupeEngineVersion !== 'string' ||
    typeof promptVersion !== 'string' ||
    typeof analyticsPayloadJson !== 'string' ||
    typeof baselineJson !== 'string' ||
    (synthesisSource !== 'AI' && synthesisSource !== 'DETERMINISTIC') ||
    (aiStatus !== 'OK' && aiStatus !== 'FAILED' && aiStatus !== 'SKIPPED') ||
    typeof portfolioLevelSummary !== 'string'
  ) {
    return undefined;
  }
  return {
    runId,
    portfolioId,
    configVersionId,
    runTriggerType,
    runStatus,
    startedAtIso,
    completedAtIso: typeof completedAtIso === 'string' ? completedAtIso : null,
    analyticsInputHash,
    analyticsSchemaVersion,
    ruleSetVersion,
    dedupeEngineVersion,
    promptVersion,
    analyticsPayloadJson,
    baselineJson,
    synthesisSource,
    aiProvider: typeof aiProvider === 'string' ? aiProvider : null,
    aiModel: typeof aiModel === 'string' ? aiModel : null,
    aiStatus,
    aiError: typeof aiError === 'string' ? aiError : null,
    aiOutputJson: typeof aiOutputJson === 'string' ? aiOutputJson : null,
    portfolioLevelSummary,
    currentStep: typeof currentStep === 'string' ? currentStep : null,
    ruleFindingsJson: typeof ruleFindingsJson === 'string' ? ruleFindingsJson : null,
    runItemCount: typeof runItemCount === 'number' ? runItemCount : 0,
    runActionableCount: typeof runActionableCount === 'number' ? runActionableCount : 0,
    runMaxStrengthScore: typeof runMaxStrengthScore === 'string' ? runMaxStrengthScore : null,
  };
}

function parseFinding(input: { readonly item: Record<string, unknown> }): RecommendationFindingRecord | undefined {
  if (input.item['entityType'] !== 'RULE_FINDING') {
    return undefined;
  }
  const runId: unknown = input.item['runId'];
  const ruleCode: unknown = input.item['ruleCode'];
  const severity: unknown = input.item['severity'];
  const scope: unknown = input.item['scope'];
  const assetId: unknown = input.item['assetId'];
  const message: unknown = input.item['message'];
  const metricsJson: unknown = input.item['metricsJson'];
  const sk: unknown = input.item['SK'];
  if (
    typeof runId !== 'string' ||
    typeof ruleCode !== 'string' ||
    typeof severity !== 'string' ||
    typeof scope !== 'string' ||
    typeof message !== 'string' ||
    typeof metricsJson !== 'string' ||
    typeof sk !== 'string'
  ) {
    return undefined;
  }
  const parts: string[] = sk.split('#');
  const findingId: string | undefined = parts[parts.length - 1];
  if (findingId === undefined || findingId.length === 0) {
    return undefined;
  }
  return {
    runId,
    findingId,
    ruleCode,
    severity,
    scope,
    assetId: typeof assetId === 'string' ? assetId : null,
    message,
    metricsJson,
  };
}

function parseItem(input: { readonly item: Record<string, unknown> }): RecommendationItemRecord | undefined {
  if (input.item['entityType'] !== 'RECOMMENDATION_ITEM') {
    return undefined;
  }
  const runId: unknown = input.item['runId'];
  const priorityRank: unknown = input.item['priorityRank'];
  const scopeType: unknown = input.item['scopeType'];
  const assetId: unknown = input.item['assetId'];
  const recommendationType: unknown = input.item['recommendationType'];
  const headline: unknown = input.item['headline'];
  const rationale: unknown = input.item['rationale'];
  const assumptions: unknown = input.item['assumptions'];
  const strengthScore: unknown = input.item['strengthScore'];
  const confidenceScore: unknown = input.item['confidenceScore'];
  const reasonCodesJson: unknown = input.item['reasonCodesJson'];
  const source: unknown = input.item['source'];
  const sk: unknown = input.item['SK'];
  if (
    typeof runId !== 'string' ||
    typeof priorityRank !== 'number' ||
    typeof scopeType !== 'string' ||
    typeof recommendationType !== 'string' ||
    typeof headline !== 'string' ||
    typeof rationale !== 'string' ||
    typeof strengthScore !== 'string' ||
    typeof confidenceScore !== 'string' ||
    typeof reasonCodesJson !== 'string' ||
    (source !== 'AI' && source !== 'DETERMINISTIC') ||
    typeof sk !== 'string'
  ) {
    return undefined;
  }
  const parts: string[] = sk.split('#');
  const itemId: string | undefined = parts[parts.length - 1];
  if (itemId === undefined || itemId.length === 0) {
    return undefined;
  }
  return {
    runId,
    itemId,
    priorityRank,
    scopeType,
    assetId: typeof assetId === 'string' ? assetId : null,
    recommendationType,
    headline,
    rationale,
    assumptions: typeof assumptions === 'string' ? assumptions : null,
    strengthScore,
    confidenceScore,
    reasonCodesJson,
    source,
  };
}

export function ruleFindingsToRecords(input: { readonly runId: string; readonly findings: readonly RuleFinding[] }): readonly RecommendationFindingRecord[] {
  return input.findings.map((f) => ({
    runId: input.runId,
    findingId: f.findingId,
    ruleCode: f.rule_code,
    severity: f.severity,
    scope: f.scope,
    assetId: f.asset_id,
    message: f.message,
    metricsJson: JSON.stringify(f.metrics_json),
  }));
}

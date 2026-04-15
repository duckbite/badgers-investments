import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DeleteCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { RECOMMENDATION_JOB_QUEUE_PARTITION_KEY, buildRecommendationJobQueueSortKey } from '../domain/domain-keys.js';

const PARTITION_KEY: string = 'PK';
const SORT_KEY: string = 'SK';

export type RecommendationQueuedJobRecord = {
  readonly userId: string;
  readonly portfolioId: string;
  readonly runId: string;
  readonly enqueuedAtIso: string;
};

export class RecommendationJobQueueRepository {
  private readonly documentClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  public constructor(input: { readonly documentClient: DynamoDBDocumentClient; readonly tableName: string }) {
    this.documentClient = input.documentClient;
    this.tableName = input.tableName;
  }

  public async enqueue(input: { readonly record: RecommendationQueuedJobRecord }): Promise<void> {
    await this.documentClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          [PARTITION_KEY]: RECOMMENDATION_JOB_QUEUE_PARTITION_KEY,
          [SORT_KEY]: buildRecommendationJobQueueSortKey({
            enqueuedAtIso: input.record.enqueuedAtIso,
            runId: input.record.runId,
          }),
          entityType: 'RECOMMENDATION_QUEUED_JOB',
          userId: input.record.userId,
          portfolioId: input.record.portfolioId,
          runId: input.record.runId,
          enqueuedAtIso: input.record.enqueuedAtIso,
        },
      }),
    );
  }

  public async listOldest(input: { readonly limit: number }): Promise<readonly RecommendationQueuedJobRecord[]> {
    const response = await this.documentClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': RECOMMENDATION_JOB_QUEUE_PARTITION_KEY,
          ':skPrefix': 'REC_JOB#',
        },
        Limit: input.limit,
        ScanIndexForward: true,
        ConsistentRead: true,
      }),
    );
    const items: readonly Record<string, unknown>[] = response.Items ?? [];
    const out: RecommendationQueuedJobRecord[] = [];
    for (const item of items) {
      const row: RecommendationQueuedJobRecord | undefined = parseJob({ item });
      if (row !== undefined) {
        out.push(row);
      }
    }
    return out;
  }

  public async deleteJob(input: { readonly enqueuedAtIso: string; readonly runId: string }): Promise<void> {
    await this.documentClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          [PARTITION_KEY]: RECOMMENDATION_JOB_QUEUE_PARTITION_KEY,
          [SORT_KEY]: buildRecommendationJobQueueSortKey({
            enqueuedAtIso: input.enqueuedAtIso,
            runId: input.runId,
          }),
        },
      }),
    );
  }

  public async deleteByRunId(input: { readonly runId: string }): Promise<void> {
    const jobs: readonly RecommendationQueuedJobRecord[] = await this.listOldest({ limit: 500 });
    const matchingJobs: readonly RecommendationQueuedJobRecord[] = jobs.filter((job) => job.runId === input.runId);
    for (const job of matchingJobs) {
      await this.deleteJob({ enqueuedAtIso: job.enqueuedAtIso, runId: job.runId });
    }
  }
}

function parseJob(input: { readonly item: Record<string, unknown> }): RecommendationQueuedJobRecord | undefined {
  if (input.item['entityType'] !== 'RECOMMENDATION_QUEUED_JOB') {
    return undefined;
  }
  const userId: unknown = input.item['userId'];
  const portfolioId: unknown = input.item['portfolioId'];
  const runId: unknown = input.item['runId'];
  const enqueuedAtIso: unknown = input.item['enqueuedAtIso'];
  if (
    typeof userId !== 'string' ||
    typeof portfolioId !== 'string' ||
    typeof runId !== 'string' ||
    typeof enqueuedAtIso !== 'string'
  ) {
    return undefined;
  }
  return { userId, portfolioId, runId, enqueuedAtIso };
}

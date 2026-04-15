import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { Context, SQSBatchResponse, SQSHandler, SQSRecord } from 'aws-lambda';
import { getDynamoDbConfig } from './config/get-dynamo-db-config.js';
import { createDynamoDbClient } from './db/create-dynamo-db-client.js';
import { instantiateRecommendationRunService } from './modules/recommendations/instantiate-recommendation-run-service.js';

type RecommendationProcessorEvent = {
  readonly userId: string;
  readonly portfolioId: string;
  readonly runId: string;
  readonly enqueuedAtIso: string;
};

function parseRecordBody(input: { readonly record: SQSRecord }): RecommendationProcessorEvent {
  const parsed: unknown = JSON.parse(input.record.body);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid recommendation processor message body.');
  }
  const candidate: Record<string, unknown> = parsed as Record<string, unknown>;
  const userId: unknown = candidate['userId'];
  const portfolioId: unknown = candidate['portfolioId'];
  const runId: unknown = candidate['runId'];
  const enqueuedAtIso: unknown = candidate['enqueuedAtIso'];
  if (
    typeof userId !== 'string' ||
    typeof portfolioId !== 'string' ||
    typeof runId !== 'string' ||
    typeof enqueuedAtIso !== 'string'
  ) {
    throw new Error('Recommendation processor message is missing required fields.');
  }
  return { userId, portfolioId, runId, enqueuedAtIso };
}

export const handler: SQSHandler = async (event, context: Context): Promise<SQSBatchResponse> => {
  void context;
  const config = getDynamoDbConfig();
  const dynamoDbClient = createDynamoDbClient(config);
  const documentClient = DynamoDBDocumentClient.from(dynamoDbClient, {
    marshallOptions: { removeUndefinedValues: true },
  });
  const service = instantiateRecommendationRunService({ documentClient, tableName: config.tableName });
  const batchItemFailures: Array<{ itemIdentifier: string }> = [];
  for (const record of event.Records) {
    try {
      const payload = parseRecordBody({ record });
      await service.completeQueuedRecommendationJob({
        userId: payload.userId,
        portfolioId: payload.portfolioId,
        runId: payload.runId,
        enqueuedAtIso: payload.enqueuedAtIso,
        now: new Date(),
      });
    } catch (error) {
      const message: string = error instanceof Error ? error.message : 'Unknown processor error.';
      console.error('Recommendation processor failed for record', { messageId: record.messageId, message });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
};

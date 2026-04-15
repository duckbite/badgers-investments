import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { getDynamoDbConfig } from '../config/get-dynamo-db-config.js';
import { createDynamoDbClient } from '../db/create-dynamo-db-client.js';
import { instantiateRecommendationRunService } from '../modules/recommendations/instantiate-recommendation-run-service.js';

async function main(): Promise<void> {
  const config = getDynamoDbConfig();
  const dynamoDbClient = createDynamoDbClient(config);
  const documentClient = DynamoDBDocumentClient.from(dynamoDbClient, {
    marshallOptions: { removeUndefinedValues: true },
  });
  const service = instantiateRecommendationRunService({ documentClient, tableName: config.tableName });
  const processed = await service.processRecommendationJobQueue({ now: new Date(), maxJobs: 25 });
  console.log(`Recommendation queue: processed ${processed.toString()} job(s).`);
}

main().catch((err: unknown) => {
  const error: Error = err instanceof Error ? err : new Error('Unknown error');
  console.error(error);
  process.exit(1);
});

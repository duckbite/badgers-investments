import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import type { DynamoDbConfig } from '../config/get-dynamo-db-config.js';

export function createDynamoDbClient(input: DynamoDbConfig): DynamoDBClient {
  return new DynamoDBClient({
    region: input.region,
    ...(input.endpoint !== undefined ? { endpoint: input.endpoint } : {}),
  });
}

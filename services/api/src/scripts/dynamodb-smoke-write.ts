import { DeleteCommand, DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoDbConfig } from '../config/get-dynamo-db-config.js';
import { createDynamoDbClient } from '../db/create-dynamo-db-client.js';

const SMOKE_PARTITION_KEY: string = 'PK';
const SMOKE_SORT_KEY: string = 'SK';
const SMOKE_PK_VALUE: string = '__dev_smoke__';
const SMOKE_SK_VALUE: string = `run-${Date.now().toString()}`;

async function main(): Promise<void> {
  const config = getDynamoDbConfig();
  const dynamoDbClient = createDynamoDbClient(config);
  const documentClient = DynamoDBDocumentClient.from(dynamoDbClient, {
    marshallOptions: { removeUndefinedValues: true },
  });
  await documentClient.send(
    new PutCommand({
      TableName: config.tableName,
      Item: {
        [SMOKE_PARTITION_KEY]: SMOKE_PK_VALUE,
        [SMOKE_SORT_KEY]: SMOKE_SK_VALUE,
        writtenAt: new Date().toISOString(),
      },
    }),
  );
  await documentClient.send(
    new DeleteCommand({
      TableName: config.tableName,
      Key: { [SMOKE_PARTITION_KEY]: SMOKE_PK_VALUE, [SMOKE_SORT_KEY]: SMOKE_SK_VALUE },
    }),
  );
  console.log(`DynamoDB smoke write/delete succeeded on table "${config.tableName}" (item cleaned up).`);
}

main().catch((err: unknown) => {
  const error: Error = err instanceof Error ? err : new Error('Unknown error');
  console.error(error);
  process.exit(1);
});

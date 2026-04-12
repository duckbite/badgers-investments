import { GetCommand, PutCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { getDynamoDbConfig } from '../config/get-dynamo-db-config.js';
import { createDynamoDbClient } from '../db/create-dynamo-db-client.js';
import { buildUserAccountPartitionKey, getMetaSortKey, normalizeUsername } from '../modules/auth/dynamo-auth-keys.js';
import { hashPassword } from '../modules/auth/password-hash-service.js';
import { randomUUID } from 'crypto';

const PARTITION_KEY: string = 'PK';
const SORT_KEY: string = 'SK';

/**
 * Upserts a single `user_account` item from env (any DynamoDB table reachable via `API_DYNAMODB_*`).
 * Reuses existing `userId` and `createdAt` when the row already exists so password updates stay stable.
 *
 * Required: `BOOTSTRAP_USERNAME`, `BOOTSTRAP_PASSWORD`
 */
async function main(): Promise<void> {
  const usernameRaw: string | undefined = process.env['BOOTSTRAP_USERNAME']?.trim();
  const password: string | undefined = process.env['BOOTSTRAP_PASSWORD'];
  if (usernameRaw === undefined || usernameRaw.length === 0 || password === undefined || password.length === 0) {
    throw new Error('Set BOOTSTRAP_USERNAME and BOOTSTRAP_PASSWORD in the environment.');
  }
  const dynamoDbConfig = getDynamoDbConfig();
  const dynamoDbClient = createDynamoDbClient(dynamoDbConfig);
  const documentClient = DynamoDBDocumentClient.from(dynamoDbClient, {
    marshallOptions: { removeUndefinedValues: true },
  });
  const usernameNormalized: string = normalizeUsername({ rawUsername: usernameRaw });
  const partitionKey: string = buildUserAccountPartitionKey({ usernameNormalized });
  const sortKey: string = getMetaSortKey();
  const existing = await documentClient.send(
    new GetCommand({
      TableName: dynamoDbConfig.tableName,
      Key: { [PARTITION_KEY]: partitionKey, [SORT_KEY]: sortKey },
      ConsistentRead: true,
    }),
  );
  const nowIso: string = new Date().toISOString();
  const existingItem: Record<string, unknown> | undefined = existing.Item as Record<string, unknown> | undefined;
  const existingUserId: unknown = existingItem?.['userId'];
  const existingCreatedAt: unknown = existingItem?.['createdAt'];
  const userId: string = typeof existingUserId === 'string' && existingUserId.length > 0 ? existingUserId : randomUUID();
  const createdAtIso: string =
    typeof existingCreatedAt === 'string' && existingCreatedAt.length > 0 ? existingCreatedAt : nowIso;
  const passwordHash: string = hashPassword(password);
  await documentClient.send(
    new PutCommand({
      TableName: dynamoDbConfig.tableName,
      Item: {
        [PARTITION_KEY]: partitionKey,
        [SORT_KEY]: sortKey,
        entityType: 'USER_ACCOUNT',
        userId,
        username: usernameRaw,
        passwordHash,
        isActive: true,
        createdAt: createdAtIso,
        updatedAt: nowIso,
      },
    }),
  );
  console.log(`Upserted user_account for username "${usernameRaw}" (PK ${partitionKey}).`);
}

main().catch((err: unknown) => {
  const error: Error = err instanceof Error ? err : new Error('Unknown error');
  console.error(error);
  process.exit(1);
});

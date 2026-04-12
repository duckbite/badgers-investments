import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, expect, it } from 'vitest';
import { UserAccountRepository } from './user-account-repository.js';
import { hashPassword } from './password-hash-service.js';

const ddbMock = mockClient(DynamoDBDocumentClient);

function createRepository(): UserAccountRepository {
  const base = new DynamoDBClient({ region: 'eu-west-1' });
  const documentClient = DynamoDBDocumentClient.from(base, {
    marshallOptions: { removeUndefinedValues: true },
  });
  return new UserAccountRepository({ documentClient, tableName: 't' });
}

describe('UserAccountRepository', () => {
  it('returns undefined when item is missing or malformed', async () => {
    ddbMock.reset();
    ddbMock.on(GetCommand).resolves({});
    const repo = createRepository();
    const missing = await repo.findByUsername({ username: 'x' });
    expect(missing).toBeUndefined();
    ddbMock.on(GetCommand).resolves({
      Item: { userId: 'u1', username: 'x', isActive: true },
    });
    const malformed = await repo.findByUsername({ username: 'x' });
    expect(malformed).toBeUndefined();
  });

  it('maps a valid item', async () => {
    ddbMock.reset();
    const hash: string = hashPassword('pw');
    ddbMock.on(GetCommand).resolves({
      Item: { userId: 'u1', username: 'Admin', passwordHash: hash, isActive: true },
    });
    const repo = createRepository();
    const actual = await repo.findByUsername({ username: 'admin' });
    expect(actual).toEqual({
      userId: 'u1',
      username: 'Admin',
      passwordHash: hash,
      isActive: true,
    });
  });

  it('updates last login', async () => {
    ddbMock.reset();
    ddbMock.on(UpdateCommand).resolves({});
    const repo = createRepository();
    await repo.touchLastLoginAt({ username: 'admin', atIso: '2026-01-01T00:00:00.000Z' });
    expect(ddbMock.commandCalls(UpdateCommand).length).toBe(1);
  });
});

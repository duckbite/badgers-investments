import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, expect, it } from 'vitest';
import { UserSessionRepository } from './user-session-repository.js';

const ddbMock = mockClient(DynamoDBDocumentClient);

function createRepository(): UserSessionRepository {
  const base = new DynamoDBClient({ region: 'eu-west-1' });
  const documentClient = DynamoDBDocumentClient.from(base, {
    marshallOptions: { removeUndefinedValues: true },
  });
  return new UserSessionRepository({ documentClient, tableName: 't' });
}

describe('UserSessionRepository', () => {
  it('creates a session item', async () => {
    ddbMock.reset();
    ddbMock.on(PutCommand).resolves({});
    const repo = createRepository();
    await repo.createSession({
      sessionId: 's1',
      userId: 'u1',
      username: 'a',
      createdAtIso: '2026-01-01T00:00:00.000Z',
      expiresAtIso: '2026-02-01T00:00:00.000Z',
      ipAddress: '127.0.0.1',
      userAgent: 'ua',
    });
    expect(ddbMock.commandCalls(PutCommand).length).toBe(1);
  });

  it('returns undefined for missing, revoked, expired, or malformed sessions', async () => {
    ddbMock.reset();
    const repo = createRepository();
    ddbMock.on(GetCommand).resolves({});
    const missing = await repo.findValidSession({ sessionId: 's', now: new Date('2026-01-15T00:00:00.000Z') });
    expect(missing).toBeUndefined();
    ddbMock.on(GetCommand).resolves({
      Item: {
        sessionId: 's',
        userId: 'u1',
        username: 'a',
        createdAt: 't',
        expiresAt: '2099-01-01T00:00:00.000Z',
        isRevoked: true,
      },
    });
    const revoked = await repo.findValidSession({ sessionId: 's', now: new Date('2026-01-15T00:00:00.000Z') });
    expect(revoked).toBeUndefined();
    ddbMock.on(GetCommand).resolves({
      Item: {
        sessionId: 's',
        userId: 'u1',
        username: 'a',
        createdAt: 't',
        expiresAt: '2020-01-01T00:00:00.000Z',
        isRevoked: false,
      },
    });
    const expired = await repo.findValidSession({ sessionId: 's', now: new Date('2026-01-15T00:00:00.000Z') });
    expect(expired).toBeUndefined();
    ddbMock.on(GetCommand).resolves({
      Item: { sessionId: 's', isRevoked: false, expiresAt: '2099-01-01T00:00:00.000Z' },
    });
    const malformed = await repo.findValidSession({ sessionId: 's', now: new Date('2026-01-15T00:00:00.000Z') });
    expect(malformed).toBeUndefined();
    ddbMock.on(GetCommand).resolves({
      Item: {
        sessionId: 's',
        userId: 'u1',
        username: 'a',
        createdAt: 't',
        expiresAt: 123,
        isRevoked: false,
      },
    });
    const badExpiresType = await repo.findValidSession({ sessionId: 's', now: new Date('2026-01-15T00:00:00.000Z') });
    expect(badExpiresType).toBeUndefined();
  });

  it('returns a valid session record', async () => {
    ddbMock.reset();
    ddbMock.on(GetCommand).resolves({
      Item: {
        sessionId: 's',
        userId: 'u1',
        username: 'a',
        createdAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2099-01-01T00:00:00.000Z',
        isRevoked: false,
      },
    });
    const repo = createRepository();
    const actual = await repo.findValidSession({ sessionId: 's', now: new Date('2026-01-15T00:00:00.000Z') });
    expect(actual).toEqual({
      sessionId: 's',
      userId: 'u1',
      username: 'a',
      createdAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2099-01-01T00:00:00.000Z',
      isRevoked: false,
    });
  });

  it('deletes a session', async () => {
    ddbMock.reset();
    ddbMock.on(DeleteCommand).resolves({});
    const repo = createRepository();
    await repo.deleteSession({ sessionId: 's' });
    expect(ddbMock.commandCalls(DeleteCommand).length).toBe(1);
  });
});

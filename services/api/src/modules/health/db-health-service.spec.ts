import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { DbHealthService } from './db-health-service.js';

type PrismaQueryRawExecutor = {
  readonly $queryRaw: (query: TemplateStringsArray, ...values: readonly unknown[]) => Promise<unknown>;
};

function createPrismaClientMock(input: { readonly response: unknown }): PrismaClient {
  const mockClient: PrismaQueryRawExecutor = {
    $queryRaw: vi.fn(async () => input.response),
  };
  return mockClient as unknown as PrismaClient;
}

describe('DbHealthService', () => {
  it('returns mapped metadata when query returns a row', async () => {
    const now: Date = new Date('2026-01-01T00:00:00.000Z');
    const prismaClient: PrismaClient = createPrismaClientMock({
      response: [
        {
          now,
          server_version: 'postgres',
          current_database: 'badgers',
          current_user: 'badgers',
        },
      ],
    });
    const service: DbHealthService = new DbHealthService({ prismaClient });
    const actual = await service.getDatabaseConnectionMetadata();
    expect(actual).toEqual({
      now,
      serverVersion: 'postgres',
      currentDatabase: 'badgers',
      currentUser: 'badgers',
    });
  });

  it('throws when query returns no rows', async () => {
    const prismaClient: PrismaClient = createPrismaClientMock({ response: [] });
    const service: DbHealthService = new DbHealthService({ prismaClient });
    await expect(service.getDatabaseConnectionMetadata()).rejects.toThrowError('Database metadata query returned no rows');
  });
});


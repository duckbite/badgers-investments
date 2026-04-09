import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startServer } from './start-server.js';

const ENVIRONMENT_KEYS = ['API_PORT'] as const;
type EnvironmentKey = (typeof ENVIRONMENT_KEYS)[number];
type EnvironmentSnapshot = Readonly<Record<EnvironmentKey, string | undefined>>;

function captureEnvironmentSnapshot(): EnvironmentSnapshot {
  return {
    API_PORT: process.env['API_PORT'],
  };
}

function restoreEnvironmentSnapshot(input: { readonly snapshot: EnvironmentSnapshot }): void {
  for (const key of ENVIRONMENT_KEYS) {
    const value: string | undefined = input.snapshot[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe('startServer', () => {
  let snapshot: EnvironmentSnapshot;

  beforeEach(() => {
    snapshot = captureEnvironmentSnapshot();
  });

  afterEach(() => {
    restoreEnvironmentSnapshot({ snapshot });
  });

  it('listens on configured port', async () => {
    process.env['API_PORT'] = '3200';
    process.env['API_DYNAMODB_TABLE_NAME'] = 't';
    process.env['API_DYNAMODB_REGION'] = 'eu-west-1';
    const listen = vi.fn(async () => undefined);
    const app = { listen } as unknown as FastifyInstance;
    await startServer({ app });
    expect(listen).toHaveBeenCalledWith({ port: 3200, host: '0.0.0.0' });
  });
});


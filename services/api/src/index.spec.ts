import { describe, expect, it, vi } from 'vitest';

describe('index entrypoint', () => {
  it('creates and starts the server', async () => {
    const createServerMock = vi.fn(async () => ({}) as unknown);
    const startServerMock = vi.fn(async () => undefined);
    vi.resetModules();
    vi.doMock('./server/create-server.js', () => ({ createServer: createServerMock }));
    vi.doMock('./server/start-server.js', () => ({ startServer: startServerMock }));
    await import('./index.ts');
    expect(createServerMock).toHaveBeenCalledTimes(1);
    expect(startServerMock).toHaveBeenCalledTimes(1);
  });
});


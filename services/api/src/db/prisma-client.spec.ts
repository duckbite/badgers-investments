import { describe, expect, it } from 'vitest';
import { prismaClient } from './prisma-client.js';

describe('prismaClient', () => {
  it('exposes Prisma client instance', () => {
    expect(prismaClient).toBeDefined();
    expect(typeof prismaClient.$disconnect).toBe('function');
    expect(typeof prismaClient.$queryRaw).toBe('function');
  });
});


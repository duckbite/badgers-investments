import { describe, expect, it, vi } from 'vitest';
import type { PortfolioConfigRepository } from './portfolio-config-repository.js';
import { PortfolioConfigService, PortfolioConfigValidationError } from './portfolio-config-service.js';
import type { PortfolioDto, PortfolioService } from './portfolio-service.js';

function buildMocks(input: {
  readonly latestVersion: number;
  readonly portfolioBaseCurrency: string;
}): {
  readonly service: PortfolioConfigService;
  readonly repo: PortfolioConfigRepository;
  readonly putVersion: ReturnType<typeof vi.fn>;
  readonly putActivePointer: ReturnType<typeof vi.fn>;
  readonly getVersionByNumber: ReturnType<typeof vi.fn>;
} {
  const putVersion = vi.fn(async () => {});
  const putActivePointer = vi.fn(async () => {});
  const getVersionByNumber = vi.fn(async () => undefined);
  const repo: PortfolioConfigRepository = {
    getActivePointer: vi.fn(async () => undefined),
    getVersionByNumber,
    findVersionByConfigId: vi.fn(async () => undefined),
    listVersions: vi.fn(async () => []),
    getLatestVersionNumber: vi.fn(async () => input.latestVersion),
    putVersion,
    putActivePointer,
  };
  const portfolio: PortfolioDto = {
    portfolioId: 'p1',
    name: 'Portfolio',
    baseCurrencyCode: input.portfolioBaseCurrency,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const portfolioService = {
    getOrCreateForUser: vi.fn(async () => portfolio),
    getForUser: vi.fn(async () => portfolio),
    updateForUser: vi.fn(async () => portfolio),
    requirePortfolioIdForUser: vi.fn(async () => portfolio.portfolioId),
  } as unknown as PortfolioService;
  const service = new PortfolioConfigService({ portfolioConfigRepository: repo as unknown as PortfolioConfigRepository, portfolioService });
  return { service, repo, putVersion, putActivePointer, getVersionByNumber };
}

const validBody = {
  riskProfileType: 'MODERATE',
  riskScore: null,
  baseCurrencyCode: 'USD',
  targetAllocations: [
    { assetClass: 'EQUITY', targetPct: '60', minPct: '50', maxPct: '70' },
    { assetClass: 'CASH', targetPct: '40', minPct: '30', maxPct: '50' },
  ],
  concentrationLimits: { maxSingleAssetPct: '40' },
  preferences: null,
  aiPromptOverrides: null,
  notes: null,
} as const;

describe('PortfolioConfigService', () => {
  it('persists version 1 when no versions exist', async () => {
    const { service, putVersion, putActivePointer, getVersionByNumber } = buildMocks({
      latestVersion: 0,
      portfolioBaseCurrency: 'USD',
    });
    getVersionByNumber.mockImplementation(async (args: { readonly versionNumber: number }) => {
      if (args.versionNumber === 1) {
        return {
          configVersionId: 'cv1',
          portfolioId: 'p1',
          userId: 'u1',
          versionNumber: 1,
          riskProfileType: 'MODERATE',
          riskScore: undefined,
          baseCurrencyCode: 'USD',
          targetAllocationsJson: validBody.targetAllocations,
          concentrationLimitsJson: validBody.concentrationLimits,
          preferencesJson: undefined,
          aiPromptOverridesJson: undefined,
          notes: undefined,
          createdByUserId: 'u1',
          createdAtIso: '2026-01-01T00:00:00.000Z',
        };
      }
      return undefined;
    });
    const actual = await service.upsertNewVersionForUser({
      userId: 'u1',
      body: { ...validBody, preferences: {}, aiPromptOverrides: {} },
      now: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(actual.versionNumber).toBe(1);
    expect(putVersion).toHaveBeenCalledTimes(1);
    const firstPutArgs = putVersion.mock.calls[0]?.[0] as { readonly versionNumber: number };
    expect(firstPutArgs.versionNumber).toBe(1);
    expect(putActivePointer).toHaveBeenCalledTimes(1);
  });

  it('rejects target rows when min exceeds target', async () => {
    const { service } = buildMocks({ latestVersion: 0, portfolioBaseCurrency: 'USD' });
    await expect(
      service.upsertNewVersionForUser({
        userId: 'u1',
        body: {
          ...validBody,
          targetAllocations: [{ assetClass: 'X', targetPct: '50', minPct: '60', maxPct: '100' }],
        },
        now: new Date(),
      }),
    ).rejects.toMatchObject({ code: 'PORTFOLIO_CONFIG_TARGET_RANGE_INVALID' });
  });

  it('rejects when targets do not sum to 100', async () => {
    const { service } = buildMocks({ latestVersion: 0, portfolioBaseCurrency: 'USD' });
    await expect(
      service.upsertNewVersionForUser({
        userId: 'u1',
        body: {
          ...validBody,
          targetAllocations: [{ assetClass: 'X', targetPct: '50', minPct: '0', maxPct: '100' }],
        },
        now: new Date(),
      }),
    ).rejects.toMatchObject({ code: 'PORTFOLIO_CONFIG_TARGET_SUM_INVALID' });
  });

  it('rejects base currency mismatch with portfolio', async () => {
    const { service } = buildMocks({ latestVersion: 0, portfolioBaseCurrency: 'EUR' });
    await expect(
      service.upsertNewVersionForUser({
        userId: 'u1',
        body: { ...validBody, baseCurrencyCode: 'USD' },
        now: new Date(),
      }),
    ).rejects.toBeInstanceOf(PortfolioConfigValidationError);
  });
});

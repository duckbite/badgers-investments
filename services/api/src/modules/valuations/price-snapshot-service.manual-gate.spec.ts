import { describe, expect, it, vi } from 'vitest';
import type { AssetRecord } from '../assets/asset-repository.js';
import type { AssetService } from '../assets/asset-service.js';
import type { PortfolioService } from '../portfolio/portfolio-service.js';
import type { SnapshotInvalidationService } from '../snapshots/snapshot-invalidation-service.js';
import { PriceSnapshotRepository } from './price-snapshot-repository.js';
import { PriceSnapshotService, PriceSnapshotValidationError } from './price-snapshot-service.js';

describe('PriceSnapshotService manual pricing gate', () => {
  it('rejects manual prices when asset has a primary price provider', async () => {
    const asset: AssetRecord = {
      assetId: 'a1',
      portfolioId: 'p1',
      assetType: 'STOCK',
      name: 'Test',
      symbol: 'TST',
      currencyCode: 'USD',
      ownershipPct: '100',
      notes: undefined,
      isin: undefined,
      exchangeCode: undefined,
      sector: undefined,
      primaryPriceProviderKey: 'YAHOO_FINANCE',
      isActive: true,
      archivedAtIso: undefined,
      createdAtIso: '',
      updatedAtIso: '',
    };
    const priceSnapshotRepository = new PriceSnapshotRepository({
      documentClient: {} as never,
      tableName: 't',
    });
    vi.spyOn(priceSnapshotRepository, 'create').mockResolvedValue(undefined);
    const portfolioService: PortfolioService = {
      requirePortfolioIdForUser: vi.fn(async () => 'p1'),
    } as never;
    const assetService: AssetService = {
      getById: vi.fn(async () => asset),
    } as never;
    const snapshotInvalidation: SnapshotInvalidationService | undefined = undefined;
    const service = new PriceSnapshotService({
      priceSnapshotRepository,
      assetService,
      portfolioService,
      snapshotInvalidation,
    });
    await expect(
      service.createManual({
        userId: 'u1',
        body: { assetId: 'a1', price: '10', currencyCode: 'USD' },
        now: new Date(),
      }),
    ).rejects.toThrow(PriceSnapshotValidationError);
    try {
      await service.createManual({
        userId: 'u1',
        body: { assetId: 'a1', price: '10', currencyCode: 'USD' },
        now: new Date(),
      });
    } catch (err) {
      expect(err).toBeInstanceOf(PriceSnapshotValidationError);
      expect((err as PriceSnapshotValidationError).code).toBe('PRICE_MANUAL_NOT_ALLOWED');
    }
  });
});

import { randomUUID } from 'crypto';
import { Decimal } from 'decimal.js';
import { isAllowedCurrencyCode, normalizeCurrencyCode } from '../domain/currency-codes.js';
import type { PortfolioService } from '../portfolio/portfolio-service.js';
import { isAllowedPrimaryPriceProviderKey } from '../market-prices/price-provider-keys.js';
import type { AssetRecord, AssetRepository, AssetType } from './asset-repository.js';

export type AssetDto = {
  readonly assetId: string;
  readonly portfolioId: string;
  readonly assetType: AssetType;
  readonly name: string;
  readonly symbol: string;
  readonly currencyCode: string;
  readonly ownershipPct: string;
  readonly notes: string | undefined;
  readonly isin: string | undefined;
  readonly exchangeCode: string | undefined;
  readonly sector: string | undefined;
  readonly primaryPriceProviderKey: string | undefined;
  readonly isActive: boolean;
  readonly archivedAt: string | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type AssetListFilter = {
  readonly assetType: AssetType | undefined;
  readonly active: 'active' | 'archived' | 'all';
};

export class AssetService {
  private readonly assetRepository: AssetRepository;
  private readonly portfolioService: PortfolioService;

  public constructor(input: { readonly assetRepository: AssetRepository; readonly portfolioService: PortfolioService }) {
    this.assetRepository = input.assetRepository;
    this.portfolioService = input.portfolioService;
  }

  public async list(input: { readonly userId: string; readonly filter: AssetListFilter; readonly now: Date }): Promise<readonly AssetDto[]> {
    const portfolioId: string = await this.portfolioService.requirePortfolioIdForUser({ userId: input.userId, now: input.now });
    const rows: readonly AssetRecord[] = await this.assetRepository.listByPortfolio({ userId: input.userId, portfolioId });
    const mapped: AssetDto[] = rows.map((row) => toDto({ record: row }));
    return mapped.filter((asset) => {
      if (input.filter.assetType !== undefined && asset.assetType !== input.filter.assetType) {
        return false;
      }
      if (input.filter.active === 'active' && !asset.isActive) {
        return false;
      }
      if (input.filter.active === 'archived' && asset.isActive) {
        return false;
      }
      return true;
    });
  }

  public async create(input: {
    readonly userId: string;
    readonly assetType: AssetType;
    readonly name: string;
    readonly symbol: string;
    readonly currencyCode: string;
    readonly ownershipPct: string;
    readonly notes: string | undefined;
    readonly isin: string | undefined;
    readonly exchangeCode: string | undefined;
    readonly sector: string | undefined;
    readonly primaryPriceProviderKey: string | null | undefined;
    readonly now: Date;
  }): Promise<AssetDto> {
    validateOwnershipPct({ raw: input.ownershipPct });
    const currency: string = normalizeCurrencyCode({ raw: input.currencyCode });
    if (!isAllowedCurrencyCode({ raw: currency })) {
      throw new AssetValidationError({ code: 'ASSET_CURRENCY_INVALID', message: 'Currency is not allowed.' });
    }
    const primaryPriceProviderKey: string | undefined = resolvePrimaryPriceProviderKeyForCreate({
      requested: input.primaryPriceProviderKey,
    });
    const portfolioId: string = await this.portfolioService.requirePortfolioIdForUser({ userId: input.userId, now: input.now });
    const assetId: string = randomUUID();
    const createdAtIso: string = input.now.toISOString();
    const ownershipNormalized: string = new Decimal(input.ownershipPct).toFixed(2);
    await this.assetRepository.create({
      userId: input.userId,
      portfolioId,
      assetId,
      assetType: input.assetType,
      name: input.name.trim(),
      symbol: input.symbol.trim(),
      currencyCode: currency,
      ownershipPct: ownershipNormalized,
      notes: input.notes,
      isin: input.isin,
      exchangeCode: input.exchangeCode,
      sector: input.sector,
      primaryPriceProviderKey,
      createdAtIso,
    });
    const created: AssetRecord | undefined = await this.assetRepository.getById({
      userId: input.userId,
      portfolioId,
      assetId,
    });
    if (created === undefined) {
      throw new Error('Asset create failed unexpectedly.');
    }
    return toDto({ record: created });
  }

  public async update(input: {
    readonly userId: string;
    readonly assetId: string;
    readonly name: string | undefined;
    readonly symbol: string | undefined;
    readonly ownershipPct: string | undefined;
    readonly notes: string | undefined;
    readonly isin: string | undefined;
    readonly exchangeCode: string | undefined;
    readonly sector: string | undefined;
    readonly primaryPriceProviderKey: string | null | undefined;
    readonly archived: boolean | undefined;
    readonly now: Date;
  }): Promise<AssetDto | undefined> {
    const portfolioId: string = await this.portfolioService.requirePortfolioIdForUser({ userId: input.userId, now: input.now });
    const existing: AssetRecord | undefined = await this.assetRepository.getById({
      userId: input.userId,
      portfolioId,
      assetId: input.assetId,
    });
    if (existing === undefined) {
      return undefined;
    }
    if (input.ownershipPct !== undefined) {
      validateOwnershipPct({ raw: input.ownershipPct });
    }
    if (input.primaryPriceProviderKey !== undefined && input.primaryPriceProviderKey !== null) {
      if (!isAllowedPrimaryPriceProviderKey({ raw: input.primaryPriceProviderKey })) {
        throw new AssetValidationError({ code: 'ASSET_PRICE_PROVIDER_INVALID', message: 'primaryPriceProviderKey is not supported.' });
      }
    }
    const updatedAtIso: string = input.now.toISOString();
    const ownership: string | undefined =
      input.ownershipPct === undefined ? undefined : new Decimal(input.ownershipPct).toFixed(2);
    let isActive: boolean | undefined;
    let archivedAtIso: string | undefined;
    if (input.archived === true) {
      isActive = false;
      archivedAtIso = updatedAtIso;
    } else if (input.archived === false) {
      isActive = true;
      archivedAtIso = undefined;
    }
    await this.assetRepository.update({
      userId: input.userId,
      portfolioId,
      assetId: input.assetId,
      name: input.name === undefined ? undefined : input.name.trim(),
      symbol: input.symbol === undefined ? undefined : input.symbol.trim(),
      ownershipPct: ownership,
      notes: input.notes,
      isin: input.isin,
      exchangeCode: input.exchangeCode,
      sector: input.sector,
      primaryPriceProviderKey: input.primaryPriceProviderKey,
      isActive,
      archivedAtIso,
      updatedAtIso,
    });
    const refreshed: AssetRecord | undefined = await this.assetRepository.getById({
      userId: input.userId,
      portfolioId,
      assetId: input.assetId,
    });
    if (refreshed === undefined) {
      return undefined;
    }
    return toDto({ record: refreshed });
  }

  public async getById(input: { readonly userId: string; readonly assetId: string; readonly now: Date }): Promise<AssetRecord | undefined> {
    const portfolioId: string = await this.portfolioService.requirePortfolioIdForUser({ userId: input.userId, now: input.now });
    return this.assetRepository.getById({ userId: input.userId, portfolioId, assetId: input.assetId });
  }
}

export class AssetValidationError extends Error {
  public readonly code: string;

  public constructor(input: { readonly code: string; readonly message: string }) {
    super(input.message);
    this.code = input.code;
  }
}

function validateOwnershipPct(input: { readonly raw: string }): void {
  const value: Decimal = new Decimal(input.raw);
  if (!value.isFinite() || value.lte(0) || value.gt(100)) {
    throw new AssetValidationError({ code: 'ASSET_OWNERSHIP_INVALID', message: 'ownershipPct must be between 0 and 100.' });
  }
}

/**
 * New assets start without a provider; the daily job sets `YAHOO_FINANCE` after a successful Yahoo quote.
 */
function resolvePrimaryPriceProviderKeyForCreate(input: { readonly requested: string | null | undefined }): string | undefined {
  if (input.requested === null || input.requested === undefined) {
    return undefined;
  }
  if (input.requested.length === 0) {
    return undefined;
  }
  if (!isAllowedPrimaryPriceProviderKey({ raw: input.requested })) {
    throw new AssetValidationError({ code: 'ASSET_PRICE_PROVIDER_INVALID', message: 'primaryPriceProviderKey is not supported.' });
  }
  return input.requested;
}

function toDto(input: { readonly record: AssetRecord }): AssetDto {
  return {
    assetId: input.record.assetId,
    portfolioId: input.record.portfolioId,
    assetType: input.record.assetType,
    name: input.record.name,
    symbol: input.record.symbol,
    currencyCode: input.record.currencyCode,
    ownershipPct: input.record.ownershipPct,
    notes: input.record.notes,
    isin: input.record.isin,
    exchangeCode: input.record.exchangeCode,
    sector: input.record.sector,
    primaryPriceProviderKey: input.record.primaryPriceProviderKey,
    isActive: input.record.isActive,
    archivedAt: input.record.archivedAtIso,
    createdAt: input.record.createdAtIso,
    updatedAt: input.record.updatedAtIso,
  };
}

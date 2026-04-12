import { randomUUID } from 'crypto';
import { isAllowedCurrencyCode, normalizeCurrencyCode } from '../domain/currency-codes.js';
import type { PortfolioRecord, PortfolioRepository } from './portfolio-repository.js';

const DEFAULT_PORTFOLIO_NAME: string = 'Portfolio';
const DEFAULT_BASE_CURRENCY: string = 'USD';

export type PortfolioDto = {
  readonly portfolioId: string;
  readonly name: string;
  readonly baseCurrencyCode: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export class PortfolioService {
  private readonly portfolioRepository: PortfolioRepository;

  public constructor(input: { readonly portfolioRepository: PortfolioRepository }) {
    this.portfolioRepository = input.portfolioRepository;
  }

  public async getOrCreateForUser(input: { readonly userId: string; readonly now: Date }): Promise<PortfolioDto> {
    const existing: PortfolioRecord | undefined = await this.portfolioRepository.findByUserId({ userId: input.userId });
    if (existing !== undefined) {
      return toDto({ record: existing });
    }
    const portfolioId: string = randomUUID();
    const createdAtIso: string = input.now.toISOString();
    await this.portfolioRepository.create({
      userId: input.userId,
      portfolioId,
      name: DEFAULT_PORTFOLIO_NAME,
      baseCurrencyCode: DEFAULT_BASE_CURRENCY,
      createdAtIso,
    });
    const created: PortfolioRecord | undefined = await this.portfolioRepository.getById({ userId: input.userId, portfolioId });
    if (created === undefined) {
      throw new Error('Portfolio create failed unexpectedly.');
    }
    return toDto({ record: created });
  }

  public async getForUser(input: { readonly userId: string }): Promise<PortfolioDto | undefined> {
    const existing: PortfolioRecord | undefined = await this.portfolioRepository.findByUserId({ userId: input.userId });
    if (existing === undefined) {
      return undefined;
    }
    return toDto({ record: existing });
  }

  public async updateForUser(input: {
    readonly userId: string;
    readonly name: string | undefined;
    readonly baseCurrencyCode: string | undefined;
    readonly now: Date;
  }): Promise<PortfolioDto | undefined> {
    const existing: PortfolioRecord | undefined = await this.portfolioRepository.findByUserId({ userId: input.userId });
    if (existing === undefined) {
      return undefined;
    }
    if (input.baseCurrencyCode !== undefined) {
      const normalized: string = normalizeCurrencyCode({ raw: input.baseCurrencyCode });
      if (!isAllowedCurrencyCode({ raw: normalized })) {
        throw new PortfolioValidationError({ code: 'PORTFOLIO_BASE_CURRENCY_INVALID', message: 'Base currency is not allowed.' });
      }
    }
    const updatedAtIso: string = input.now.toISOString();
    await this.portfolioRepository.update({
      userId: input.userId,
      portfolioId: existing.portfolioId,
      name: input.name,
      baseCurrencyCode:
        input.baseCurrencyCode === undefined ? undefined : normalizeCurrencyCode({ raw: input.baseCurrencyCode }),
      updatedAtIso,
    });
    const refreshed: PortfolioRecord | undefined = await this.portfolioRepository.getById({
      userId: input.userId,
      portfolioId: existing.portfolioId,
    });
    if (refreshed === undefined) {
      return undefined;
    }
    return toDto({ record: refreshed });
  }

  public async requirePortfolioIdForUser(input: { readonly userId: string; readonly now: Date }): Promise<string> {
    const portfolio: PortfolioDto = await this.getOrCreateForUser({ userId: input.userId, now: input.now });
    return portfolio.portfolioId;
  }
}

export class PortfolioValidationError extends Error {
  public readonly code: string;

  public constructor(input: { readonly code: string; readonly message: string }) {
    super(input.message);
    this.code = input.code;
  }
}

function toDto(input: { readonly record: PortfolioRecord }): PortfolioDto {
  return {
    portfolioId: input.record.portfolioId,
    name: input.record.name,
    baseCurrencyCode: input.record.baseCurrencyCode,
    createdAt: input.record.createdAtIso,
    updatedAt: input.record.updatedAtIso,
  };
}

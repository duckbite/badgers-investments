import { randomUUID } from 'crypto';
import { Decimal } from 'decimal.js';
import { isAllowedCurrencyCode, normalizeCurrencyCode } from '../domain/currency-codes.js';
import type { PortfolioService } from './portfolio-service.js';
import type {
  PortfolioConfigActivePointerRecord,
  PortfolioConfigRepository,
  PortfolioConfigVersionRecord,
} from './portfolio-config-repository.js';

const RISK_PROFILE_TYPES: ReadonlySet<string> = new Set([
  'CONSERVATIVE',
  'MODERATE',
  'BALANCED',
  'GROWTH',
  'AGGRESSIVE',
]);

const TARGET_SUM_TOLERANCE: string = '0.0001';

export type TargetAllocationInput = {
  readonly assetClass: string;
  readonly targetPct: string;
  readonly minPct: string;
  readonly maxPct: string;
};

export type PortfolioConfigUpsertBody = {
  readonly riskProfileType: string;
  readonly riskScore: number | null;
  readonly baseCurrencyCode: string;
  readonly targetAllocations: readonly TargetAllocationInput[];
  readonly concentrationLimits: Readonly<Record<string, string>>;
  readonly preferences: unknown;
  readonly aiPromptOverrides: unknown;
  readonly notes: string | null;
};

export type PortfolioConfigFullDto = {
  readonly configVersionId: string;
  readonly versionNumber: number;
  readonly isActive: boolean;
  readonly riskProfileType: string;
  readonly riskScore: number | null;
  readonly baseCurrencyCode: string;
  readonly targetAllocations: unknown;
  readonly concentrationLimits: unknown;
  readonly preferences: unknown;
  readonly aiPromptOverrides: unknown;
  readonly notes: string | null;
  readonly createdByUserId: string;
  readonly createdAt: string;
};

export type PortfolioConfigVersionSummaryDto = {
  readonly configVersionId: string;
  readonly versionNumber: number;
  readonly isActive: boolean;
  readonly createdAt: string;
};

export class PortfolioConfigValidationError extends Error {
  public readonly code: string;

  public constructor(input: { readonly code: string; readonly message: string }) {
    super(input.message);
    this.code = input.code;
  }
}

export class PortfolioConfigService {
  private readonly portfolioConfigRepository: PortfolioConfigRepository;
  private readonly portfolioService: PortfolioService;

  public constructor(input: { readonly portfolioConfigRepository: PortfolioConfigRepository; readonly portfolioService: PortfolioService }) {
    this.portfolioConfigRepository = input.portfolioConfigRepository;
    this.portfolioService = input.portfolioService;
  }

  public async getActiveForUser(input: { readonly userId: string; readonly now: Date }): Promise<PortfolioConfigFullDto> {
    const portfolio = await this.portfolioService.getOrCreateForUser({ userId: input.userId, now: input.now });
    let pointer: PortfolioConfigActivePointerRecord | undefined = await this.portfolioConfigRepository.getActivePointer({
      userId: input.userId,
      portfolioId: portfolio.portfolioId,
    });
    if (pointer === undefined) {
      await this.seedInitialVersion({
        userId: input.userId,
        portfolioId: portfolio.portfolioId,
        baseCurrencyCode: portfolio.baseCurrencyCode,
        now: input.now,
      });
      pointer = await this.portfolioConfigRepository.getActivePointer({
        userId: input.userId,
        portfolioId: portfolio.portfolioId,
      });
    }
    if (pointer === undefined) {
      throw new Error('Portfolio config seed failed unexpectedly.');
    }
    const record: PortfolioConfigVersionRecord | undefined = await this.portfolioConfigRepository.getVersionByNumber({
      userId: input.userId,
      portfolioId: portfolio.portfolioId,
      versionNumber: pointer.activeVersionNumber,
    });
    if (record === undefined) {
      const byId: PortfolioConfigVersionRecord | undefined = await this.portfolioConfigRepository.findVersionByConfigId({
        userId: input.userId,
        portfolioId: portfolio.portfolioId,
        configVersionId: pointer.activeConfigVersionId,
      });
      if (byId === undefined) {
        throw new Error('Active portfolio config version not found.');
      }
      return toFullDto({ record: byId, isActive: true });
    }
    return toFullDto({ record, isActive: true });
  }

  public async listVersionSummariesForUser(input: { readonly userId: string; readonly now: Date }): Promise<readonly PortfolioConfigVersionSummaryDto[]> {
    const portfolio = await this.portfolioService.getOrCreateForUser({ userId: input.userId, now: input.now });
    const portfolioId: string = portfolio.portfolioId;
    const pointer: PortfolioConfigActivePointerRecord | undefined = await this.portfolioConfigRepository.getActivePointer({
      userId: input.userId,
      portfolioId,
    });
    const versions: readonly PortfolioConfigVersionRecord[] = await this.portfolioConfigRepository.listVersions({
      userId: input.userId,
      portfolioId,
    });
    return versions.map((record) =>
      toSummaryDto({
        record,
        isActive: pointer !== undefined && pointer.activeConfigVersionId === record.configVersionId,
      }),
    );
  }

  public async upsertNewVersionForUser(input: {
    readonly userId: string;
    readonly body: PortfolioConfigUpsertBody;
    readonly now: Date;
  }): Promise<PortfolioConfigFullDto> {
    const portfolio = await this.portfolioService.getOrCreateForUser({ userId: input.userId, now: input.now });
    validateUpsertBody({
      body: input.body,
      portfolioBaseCurrencyCode: portfolio.baseCurrencyCode,
    });
    const portfolioId: string = portfolio.portfolioId;
    const createdAtIso: string = input.now.toISOString();
    const configVersionId: string = randomUUID();
    const recordBase: Omit<PortfolioConfigVersionRecord, 'versionNumber' | 'portfolioId' | 'userId'> = {
      configVersionId,
      riskProfileType: input.body.riskProfileType.trim().toUpperCase(),
      riskScore: input.body.riskScore === null ? undefined : input.body.riskScore,
      baseCurrencyCode: normalizeCurrencyCode({ raw: input.body.baseCurrencyCode }),
      targetAllocationsJson: input.body.targetAllocations,
      concentrationLimitsJson: input.body.concentrationLimits,
      ...(input.body.preferences === null || input.body.preferences === undefined
        ? {}
        : { preferencesJson: input.body.preferences }),
      ...(input.body.aiPromptOverrides === null || input.body.aiPromptOverrides === undefined
        ? {}
        : { aiPromptOverridesJson: input.body.aiPromptOverrides }),
      notes: input.body.notes === null ? undefined : input.body.notes,
      createdByUserId: input.userId,
      createdAtIso,
    };
    const latest: number = await this.portfolioConfigRepository.getLatestVersionNumber({ userId: input.userId, portfolioId });
    let nextVersion: number;
    if (latest === 0) {
      await this.portfolioConfigRepository.putVersion({
        userId: input.userId,
        portfolioId,
        versionNumber: 1,
        record: recordBase,
      });
      nextVersion = 1;
    } else {
      nextVersion = await this.allocateNextVersionNumberWithRetry({
        userId: input.userId,
        portfolioId,
        recordBase,
      });
    }
    const newPointer: PortfolioConfigActivePointerRecord = {
      activeConfigVersionId: configVersionId,
      activeVersionNumber: nextVersion,
      updatedAtIso: createdAtIso,
    };
    await this.portfolioConfigRepository.putActivePointer({
      userId: input.userId,
      portfolioId,
      pointer: newPointer,
    });
    const saved: PortfolioConfigVersionRecord | undefined = await this.portfolioConfigRepository.getVersionByNumber({
      userId: input.userId,
      portfolioId,
      versionNumber: nextVersion,
    });
    if (saved === undefined) {
      throw new Error('Portfolio config version persist failed unexpectedly.');
    }
    return toFullDto({ record: saved, isActive: true });
  }

  private async seedInitialVersion(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly baseCurrencyCode: string;
    readonly now: Date;
  }): Promise<void> {
    const createdAtIso: string = input.now.toISOString();
    const configVersionId: string = randomUUID();
    const recordBase: Omit<PortfolioConfigVersionRecord, 'versionNumber' | 'portfolioId' | 'userId'> = {
      configVersionId,
      riskProfileType: 'MODERATE',
      riskScore: undefined,
      baseCurrencyCode: input.baseCurrencyCode,
      targetAllocationsJson: [
        { assetClass: 'UNCLASSIFIED', targetPct: '100', minPct: '0', maxPct: '100' },
      ],
      concentrationLimitsJson: { maxSingleAssetPct: '100' },
      preferencesJson: undefined,
      aiPromptOverridesJson: undefined,
      notes: undefined,
      createdByUserId: input.userId,
      createdAtIso,
    };
    await this.portfolioConfigRepository.putVersion({
      userId: input.userId,
      portfolioId: input.portfolioId,
      versionNumber: 1,
      record: recordBase,
    });
    await this.portfolioConfigRepository.putActivePointer({
      userId: input.userId,
      portfolioId: input.portfolioId,
      pointer: {
        activeConfigVersionId: configVersionId,
        activeVersionNumber: 1,
        updatedAtIso: createdAtIso,
      },
    });
  }

  private async allocateNextVersionNumberWithRetry(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly recordBase: Omit<PortfolioConfigVersionRecord, 'versionNumber' | 'portfolioId' | 'userId'>;
  }): Promise<number> {
    const maxAttempts: number = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const latest: number = await this.portfolioConfigRepository.getLatestVersionNumber({
        userId: input.userId,
        portfolioId: input.portfolioId,
      });
      const nextVersion: number = latest + 1;
      try {
        await this.portfolioConfigRepository.putVersion({
          userId: input.userId,
          portfolioId: input.portfolioId,
          versionNumber: nextVersion,
          record: input.recordBase,
        });
        return nextVersion;
      } catch (err: unknown) {
        if (!isConditionalCheckFailed(err) || attempt === maxAttempts - 1) {
          throw err;
        }
      }
    }
    throw new Error('Failed to allocate portfolio config version.');
  }
}

function isConditionalCheckFailed(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { readonly name?: string }).name === 'ConditionalCheckFailedException'
  );
}

function validateUpsertBody(input: { readonly body: PortfolioConfigUpsertBody; readonly portfolioBaseCurrencyCode: string }): void {
  const profile: string = input.body.riskProfileType.trim().toUpperCase();
  if (!RISK_PROFILE_TYPES.has(profile)) {
    throw new PortfolioConfigValidationError({ code: 'PORTFOLIO_CONFIG_RISK_PROFILE_INVALID', message: 'Risk profile type is not allowed.' });
  }
  if (input.body.riskScore !== null) {
    const score: number = input.body.riskScore;
    if (!Number.isInteger(score) || score < 1 || score > 100) {
      throw new PortfolioConfigValidationError({
        code: 'PORTFOLIO_CONFIG_RISK_SCORE_INVALID',
        message: 'Risk score must be an integer between 1 and 100, or null.',
      });
    }
  }
  const base: string = normalizeCurrencyCode({ raw: input.body.baseCurrencyCode });
  if (!isAllowedCurrencyCode({ raw: base })) {
    throw new PortfolioConfigValidationError({ code: 'PORTFOLIO_CONFIG_BASE_CURRENCY_INVALID', message: 'Base currency is not allowed.' });
  }
  if (base !== normalizeCurrencyCode({ raw: input.portfolioBaseCurrencyCode })) {
    throw new PortfolioConfigValidationError({
      code: 'PORTFOLIO_CONFIG_BASE_CURRENCY_MISMATCH',
      message: 'Config base currency must match the portfolio base currency.',
    });
  }
  if (!Array.isArray(input.body.targetAllocations) || input.body.targetAllocations.length === 0) {
    throw new PortfolioConfigValidationError({
      code: 'PORTFOLIO_CONFIG_TARGETS_REQUIRED',
      message: 'At least one target allocation row is required.',
    });
  }
  let sum: Decimal = new Decimal(0);
  const targetRows: readonly TargetAllocationInput[] = input.body.targetAllocations;
  for (const row of targetRows) {
    if (typeof row.assetClass !== 'string' || row.assetClass.trim().length === 0) {
      throw new PortfolioConfigValidationError({ code: 'PORTFOLIO_CONFIG_ASSET_CLASS_INVALID', message: 'Each target row needs a non-empty asset class.' });
    }
    const target: Decimal = parsePercentDecimal({ raw: row.targetPct, field: 'targetPct' });
    const min: Decimal = parsePercentDecimal({ raw: row.minPct, field: 'minPct' });
    const max: Decimal = parsePercentDecimal({ raw: row.maxPct, field: 'maxPct' });
    if (min.greaterThan(target) || target.greaterThan(max)) {
      throw new PortfolioConfigValidationError({
        code: 'PORTFOLIO_CONFIG_TARGET_RANGE_INVALID',
        message: 'Each target row must satisfy minPct ≤ targetPct ≤ maxPct.',
      });
    }
    sum = sum.plus(target);
  }
  const expected: Decimal = new Decimal(100);
  if (sum.minus(expected).abs().greaterThan(new Decimal(TARGET_SUM_TOLERANCE))) {
    throw new PortfolioConfigValidationError({
      code: 'PORTFOLIO_CONFIG_TARGET_SUM_INVALID',
      message: 'Target allocation percentages must sum to 100.',
    });
  }
  if (typeof input.body.concentrationLimits !== 'object' || input.body.concentrationLimits === null || Array.isArray(input.body.concentrationLimits)) {
    throw new PortfolioConfigValidationError({
      code: 'PORTFOLIO_CONFIG_LIMITS_INVALID',
      message: 'Concentration limits must be a string-keyed object of percentage strings.',
    });
  }
  for (const [key, value] of Object.entries(input.body.concentrationLimits)) {
    if (typeof key !== 'string' || key.trim().length === 0) {
      throw new PortfolioConfigValidationError({ code: 'PORTFOLIO_CONFIG_LIMITS_INVALID', message: 'Concentration limit keys must be non-empty strings.' });
    }
    if (typeof value !== 'string') {
      throw new PortfolioConfigValidationError({ code: 'PORTFOLIO_CONFIG_LIMITS_INVALID', message: 'Concentration limit values must be decimal strings.' });
    }
    parsePercentDecimal({ raw: value, field: key });
  }
  if (input.body.notes !== null && typeof input.body.notes !== 'string') {
    throw new PortfolioConfigValidationError({ code: 'PORTFOLIO_CONFIG_NOTES_INVALID', message: 'Notes must be a string or null.' });
  }
}

function parsePercentDecimal(input: { readonly raw: string; readonly field: string }): Decimal {
  const trimmed: string = input.raw.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new PortfolioConfigValidationError({
      code: 'PORTFOLIO_CONFIG_PERCENT_INVALID',
      message: `Percentage "${input.field}" must be a non-negative decimal string.`,
    });
  }
  const value: Decimal = new Decimal(trimmed);
  if (value.isNegative() || value.greaterThan(100)) {
    throw new PortfolioConfigValidationError({
      code: 'PORTFOLIO_CONFIG_PERCENT_INVALID',
      message: `Percentage "${input.field}" must be between 0 and 100.`,
    });
  }
  return value;
}

function toFullDto(input: { readonly record: PortfolioConfigVersionRecord; readonly isActive: boolean }): PortfolioConfigFullDto {
  return {
    configVersionId: input.record.configVersionId,
    versionNumber: input.record.versionNumber,
    isActive: input.isActive,
    riskProfileType: input.record.riskProfileType,
    riskScore: input.record.riskScore === undefined ? null : input.record.riskScore,
    baseCurrencyCode: input.record.baseCurrencyCode,
    targetAllocations: input.record.targetAllocationsJson,
    concentrationLimits: input.record.concentrationLimitsJson,
    preferences: input.record.preferencesJson === undefined ? null : input.record.preferencesJson,
    aiPromptOverrides: input.record.aiPromptOverridesJson === undefined ? null : input.record.aiPromptOverridesJson,
    notes: input.record.notes === undefined ? null : input.record.notes,
    createdByUserId: input.record.createdByUserId,
    createdAt: input.record.createdAtIso,
  };
}

function toSummaryDto(input: { readonly record: PortfolioConfigVersionRecord; readonly isActive: boolean }): PortfolioConfigVersionSummaryDto {
  return {
    configVersionId: input.record.configVersionId,
    versionNumber: input.record.versionNumber,
    isActive: input.isActive,
    createdAt: input.record.createdAtIso,
  };
}

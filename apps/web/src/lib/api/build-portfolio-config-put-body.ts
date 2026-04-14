/**
 * `PUT /portfolio/config` only accepts these fields (`additionalProperties: false` on the API).
 * Never spread the full GET DTO — it includes `configVersionId`, `versionNumber`, etc. and will fail validation.
 */
export type PortfolioConfigDto = {
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

export type PortfolioConfigPutBody = {
  readonly riskProfileType: string;
  readonly riskScore: number | null;
  readonly baseCurrencyCode: string;
  readonly targetAllocations: unknown;
  readonly concentrationLimits: unknown;
  readonly preferences: unknown;
  readonly aiPromptOverrides: unknown;
  readonly notes: string | null;
};

type Patch = Partial<
  Pick<
    PortfolioConfigDto,
    | 'riskProfileType'
    | 'riskScore'
    | 'baseCurrencyCode'
    | 'targetAllocations'
    | 'concentrationLimits'
    | 'preferences'
    | 'aiPromptOverrides'
    | 'notes'
  >
>;

export function buildPortfolioConfigPutBody(cfg: PortfolioConfigDto, patch: Patch = {}): PortfolioConfigPutBody {
  return {
    riskProfileType: patch.riskProfileType ?? cfg.riskProfileType,
    riskScore: patch.riskScore !== undefined ? patch.riskScore : cfg.riskScore,
    baseCurrencyCode: patch.baseCurrencyCode ?? cfg.baseCurrencyCode,
    targetAllocations: patch.targetAllocations ?? cfg.targetAllocations,
    concentrationLimits: patch.concentrationLimits ?? cfg.concentrationLimits,
    preferences: patch.preferences !== undefined ? patch.preferences : cfg.preferences,
    aiPromptOverrides: patch.aiPromptOverrides !== undefined ? patch.aiPromptOverrides : cfg.aiPromptOverrides,
    notes: patch.notes !== undefined ? patch.notes : cfg.notes,
  };
}

import type { RecommendationAnalyticsPayload } from './recommendation-analytics-payload-types.js';
import { tryParseJsonFromLlmText } from './coerce-llm-json-text.js';

export type AiPortfolioSummaryOutput = {
  readonly recommendation_type: 'BUY' | 'SELL' | 'HOLD' | 'WATCH';
  readonly headline: string;
  readonly rationale: string;
  readonly assumptions: string;
  readonly strength_score: number;
  readonly confidence_score: number;
};

export type AiItemOutput = {
  readonly scope_type: 'PORTFOLIO' | 'ASSET';
  readonly asset_id: string | null;
  readonly recommendation_type: 'BUY' | 'SELL' | 'HOLD' | 'WATCH';
  readonly headline: string;
  readonly rationale: string;
  readonly assumptions: string;
  readonly strength_score: number;
  readonly confidence_score: number;
  readonly reason_codes: readonly string[];
};

export type AiRecommendationOutputValidated = {
  readonly portfolio_summary: AiPortfolioSummaryOutput;
  readonly items: readonly AiItemOutput[];
  readonly disclaimer_note: string;
};

function isAllowedRecType(raw: string): raw is AiPortfolioSummaryOutput['recommendation_type'] {
  return raw === 'BUY' || raw === 'SELL' || raw === 'HOLD' || raw === 'WATCH';
}

function isScope(raw: string): raw is AiItemOutput['scope_type'] {
  return raw === 'PORTFOLIO' || raw === 'ASSET';
}

function inScoreRange(input: { readonly n: number }): boolean {
  return Number.isFinite(input.n) && input.n >= 0 && input.n <= 100;
}

const assetIdSet = (input: { readonly payload: RecommendationAnalyticsPayload }): ReadonlySet<string> =>
  new Set(input.payload.assets.map((a) => a.asset_id));

export function parseAndValidateAiRecommendationJson(input: {
  readonly rawText: string;
  readonly payload: RecommendationAnalyticsPayload;
}): { readonly ok: true; readonly value: AiRecommendationOutputValidated } | { readonly ok: false; readonly message: string } {
  const jsonParsed = tryParseJsonFromLlmText(input.rawText);
  if (!jsonParsed.ok) {
    return { ok: false, message: 'AI output is not valid JSON.' };
  }
  const parsed: unknown = jsonParsed.value;
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, message: 'AI output JSON must be an object.' };
  }
  const root: Record<string, unknown> = parsed as Record<string, unknown>;
  const portfolio_summary: unknown = root['portfolio_summary'];
  const items: unknown = root['items'];
  const disclaimer_note: unknown = root['disclaimer_note'];
  if (typeof portfolio_summary !== 'object' || portfolio_summary === null) {
    return { ok: false, message: 'Missing portfolio_summary object.' };
  }
  if (!Array.isArray(items)) {
    return { ok: false, message: 'Missing items array.' };
  }
  if (typeof disclaimer_note !== 'string' || disclaimer_note.trim().length === 0) {
    return { ok: false, message: 'Missing disclaimer_note string.' };
  }
  const ps: Record<string, unknown> = portfolio_summary as Record<string, unknown>;
  const psType: unknown = ps['recommendation_type'];
  const psHeadline: unknown = ps['headline'];
  const psRationale: unknown = ps['rationale'];
  const psAssumptions: unknown = ps['assumptions'];
  const psStrength: unknown = ps['strength_score'];
  const psConf: unknown = ps['confidence_score'];
  if (typeof psType !== 'string' || !isAllowedRecType(psType)) {
    return { ok: false, message: 'Invalid portfolio_summary.recommendation_type.' };
  }
  if (typeof psHeadline !== 'string' || psHeadline.trim().length === 0) {
    return { ok: false, message: 'Invalid portfolio_summary.headline.' };
  }
  if (typeof psRationale !== 'string' || psRationale.trim().length === 0) {
    return { ok: false, message: 'Invalid portfolio_summary.rationale.' };
  }
  if (typeof psAssumptions !== 'string' || psAssumptions.trim().length === 0) {
    return { ok: false, message: 'Invalid portfolio_summary.assumptions.' };
  }
  if (typeof psStrength !== 'number' || !inScoreRange({ n: psStrength })) {
    return { ok: false, message: 'Invalid portfolio_summary.strength_score.' };
  }
  if (typeof psConf !== 'number' || !inScoreRange({ n: psConf })) {
    return { ok: false, message: 'Invalid portfolio_summary.confidence_score.' };
  }
  const allowedAssets: ReadonlySet<string> = assetIdSet({ payload: input.payload });
  const outItems: AiItemOutput[] = [];
  for (const entry of items) {
    if (typeof entry !== 'object' || entry === null) {
      return { ok: false, message: 'Invalid item entry.' };
    }
    const row: Record<string, unknown> = entry as Record<string, unknown>;
    const scope_type: unknown = row['scope_type'];
    const asset_id: unknown = row['asset_id'];
    const recommendation_type: unknown = row['recommendation_type'];
    const headline: unknown = row['headline'];
    const rationale: unknown = row['rationale'];
    const assumptions: unknown = row['assumptions'];
    const strength_score: unknown = row['strength_score'];
    const confidence_score: unknown = row['confidence_score'];
    const reason_codes: unknown = row['reason_codes'];
    if (typeof scope_type !== 'string' || !isScope(scope_type)) {
      return { ok: false, message: 'Invalid item.scope_type.' };
    }
    if (scope_type === 'ASSET') {
      if (typeof asset_id !== 'string' || !allowedAssets.has(asset_id)) {
        return { ok: false, message: 'Invalid or unknown item.asset_id.' };
      }
    } else if (asset_id !== null && asset_id !== undefined) {
      return { ok: false, message: 'PORTFOLIO item must not set asset_id.' };
    }
    if (typeof recommendation_type !== 'string' || !isAllowedRecType(recommendation_type)) {
      return { ok: false, message: 'Invalid item.recommendation_type.' };
    }
    if (typeof headline !== 'string' || headline.trim().length === 0) {
      return { ok: false, message: 'Invalid item.headline.' };
    }
    if (typeof rationale !== 'string' || rationale.trim().length === 0) {
      return { ok: false, message: 'Invalid item.rationale.' };
    }
    if (typeof assumptions !== 'string' || assumptions.trim().length === 0) {
      return { ok: false, message: 'Invalid item.assumptions.' };
    }
    if (typeof strength_score !== 'number' || !inScoreRange({ n: strength_score })) {
      return { ok: false, message: 'Invalid item.strength_score.' };
    }
    if (typeof confidence_score !== 'number' || !inScoreRange({ n: confidence_score })) {
      return { ok: false, message: 'Invalid item.confidence_score.' };
    }
    if (!Array.isArray(reason_codes) || !reason_codes.every((c) => typeof c === 'string')) {
      return { ok: false, message: 'Invalid item.reason_codes.' };
    }
    const assetIdResolved: string | null = scope_type === 'ASSET' ? (asset_id as string) : null;
    outItems.push({
      scope_type,
      asset_id: assetIdResolved,
      recommendation_type,
      headline,
      rationale,
      assumptions,
      strength_score,
      confidence_score,
      reason_codes,
    });
  }
  return {
    ok: true,
    value: {
      portfolio_summary: {
        recommendation_type: psType,
        headline: psHeadline,
        rationale: psRationale,
        assumptions: psAssumptions,
        strength_score: psStrength,
        confidence_score: psConf,
      },
      items: outItems,
      disclaimer_note,
    },
  };
}

import type { RecommendationAnalyticsPayload } from './recommendation-analytics-payload-types.js';
import type { RuleFinding } from './recommendation-rule-types.js';

export type BaselineRecommendationItem = {
  readonly scope_type: 'PORTFOLIO' | 'ASSET';
  readonly asset_id: string | null;
  readonly recommendation_type: 'BUY' | 'SELL' | 'HOLD' | 'WATCH';
  readonly headline: string;
  readonly rationale: string;
  readonly strength_score: number;
  readonly confidence_score: number;
  readonly reason_codes: readonly string[];
};

export type BaselineRecommendationResult = {
  readonly portfolio_summary: {
    readonly recommendation_type: 'BUY' | 'SELL' | 'HOLD' | 'WATCH';
    readonly headline: string;
    readonly rationale: string;
    readonly strength_score: number;
    readonly confidence_score: number;
  };
  readonly items: readonly BaselineRecommendationItem[];
};

function clampScore(input: { readonly value: number }): number {
  return Math.max(0, Math.min(100, Math.round(input.value)));
}

function severityWeight(input: { readonly severity: RuleFinding['severity'] }): number {
  if (input.severity === 'HIGH') {
    return 25;
  }
  if (input.severity === 'WARN') {
    return 10;
  }
  return 3;
}

function hasRule(input: { readonly findings: readonly RuleFinding[]; readonly codes: readonly string[] }): boolean {
  const set: Set<string> = new Set(input.codes);
  return input.findings.some((f) => set.has(f.rule_code));
}

/**
 * Deterministic strength/confidence and BUY/SELL/HOLD/WATCH baseline per recommendation-spec-v1 §10–11.
 */
export function buildDeterministicRecommendations(input: {
  readonly payload: RecommendationAnalyticsPayload;
  readonly findings: readonly RuleFinding[];
}): BaselineRecommendationResult {
  let strength: number = 50;
  for (const f of input.findings) {
    strength += severityWeight({ severity: f.severity });
  }
  const market: number = input.payload.quality.market_asset_count;
  const priced: number = input.payload.quality.priced_asset_count;
  const coverage: number = market > 0 ? priced / market : 1;
  let deviationBonus = 0;
  for (const f of input.findings) {
    if (f.rule_code === 'R101' || f.rule_code === 'R102') {
      const delta: unknown = f.metrics_json['delta_pct'];
      if (typeof delta === 'number' && Number.isFinite(delta)) {
        deviationBonus += Math.min(20, Math.abs(delta));
      }
    }
  }
  strength += Math.min(20, deviationBonus);
  for (const a of input.payload.assets) {
    const h: number | null = a.price_freshness_hours;
    if (h === null || a.allocation_pct < 5) {
      continue;
    }
    if (h > 120) {
      strength -= 20;
    } else if (h > 48) {
      strength -= 10;
    }
  }
  strength = clampScore({ value: strength });
  let confidence: number = 90;
  if (coverage < 0.8) {
    confidence -= 30;
  } else if (coverage < 1) {
    confidence -= 15;
  }
  for (const a of input.payload.assets) {
    if (a.allocation_pct <= 10) {
      continue;
    }
    const h: number | null = a.price_freshness_hours;
    if (h !== null && h > 48) {
      confidence -= 10;
    }
  }
  if (input.findings.some((f) => f.rule_code === 'R501')) {
    confidence -= 5;
  }
  confidence = clampScore({ value: confidence });
  const hardDataGate: boolean = input.findings.some((f) => f.rule_code === 'R003' && f.severity === 'HIGH');
  const concentrationSell: boolean = hasRule({
    findings: input.findings,
    codes: ['R201', 'R203', 'R204'],
  });
  const underweight: boolean = hasRule({ findings: input.findings, codes: ['R101'] });
  const overweight: boolean = hasRule({ findings: input.findings, codes: ['R102'] });
  let portfolioType: BaselineRecommendationItem['recommendation_type'] = 'HOLD';
  let headline = 'Hold current positioning';
  let rationale =
    'No severe concentration breaches detected; allocations are broadly within configured bands after applying deterministic rules.';
  if (hardDataGate) {
    portfolioType = 'HOLD';
    headline = 'Hold — verify data coverage first';
    rationale =
      'Price coverage is materially incomplete; avoid aggressive trades until market values are refreshed for the portfolio.';
  } else if (concentrationSell) {
    portfolioType = 'SELL';
    headline = 'Reduce concentration risk';
    rationale = 'Deterministic rules flagged concentration or sleeve limits; trimming risk sleeves is the baseline priority.';
  } else if (underweight && !overweight) {
    portfolioType = 'BUY';
    headline = 'Deploy toward targets';
    rationale = 'At least one asset class is below its configured minimum; consider adding exposure if data quality supports it.';
  }
  if (portfolioType === 'HOLD' && hasRule({ findings: input.findings, codes: ['R402', 'R403'] })) {
    headline = 'Hold — review drawdowns';
    rationale = 'Recent performance or material unrealised losses warrant review while maintaining baseline discipline.';
  }
  const items: BaselineRecommendationItem[] = [];
  for (const f of input.findings) {
    if (f.scope !== 'ASSET' || f.asset_id === null) {
      continue;
    }
    if (f.rule_code === 'R201') {
      items.push({
        scope_type: 'ASSET',
        asset_id: f.asset_id,
        recommendation_type: 'SELL',
        headline: 'Trim concentrated position',
        rationale: f.message,
        strength_score: strength,
        confidence_score: confidence,
        reason_codes: [f.rule_code],
      });
    } else if (f.rule_code === 'R202') {
      items.push({
        scope_type: 'ASSET',
        asset_id: f.asset_id,
        recommendation_type: 'WATCH',
        headline: 'Watch concentration',
        rationale: f.message,
        strength_score: strength,
        confidence_score: confidence,
        reason_codes: [f.rule_code],
      });
    } else if (f.rule_code === 'R001') {
      items.push({
        scope_type: 'ASSET',
        asset_id: f.asset_id,
        recommendation_type: 'HOLD',
        headline: 'Stale pricing on holding',
        rationale: f.message,
        strength_score: strength,
        confidence_score: confidence,
        reason_codes: [f.rule_code],
      });
    } else if (f.rule_code === 'R402') {
      items.push({
        scope_type: 'ASSET',
        asset_id: f.asset_id,
        recommendation_type: 'HOLD',
        headline: 'Review underwater position',
        rationale: f.message,
        strength_score: strength,
        confidence_score: confidence,
        reason_codes: [f.rule_code],
      });
    }
  }
  return {
    portfolio_summary: {
      recommendation_type: portfolioType,
      headline,
      rationale,
      strength_score: strength,
      confidence_score: confidence,
    },
    items,
  };
}

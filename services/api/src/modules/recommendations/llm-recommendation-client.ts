import type { RecommendationAnalyticsPayload } from './recommendation-analytics-payload-types.js';
import type { RuleFinding } from './recommendation-rule-types.js';
import type { BaselineRecommendationResult } from './baseline-deterministic-recommendations.js';
import { AI_PROMPT_VERSION, RULE_SET_VERSION } from './recommendation-engine-constants.js';
import { requestAnthropicRecommendationJson } from './anthropic-recommendation-llm-adapter.js';

function buildSystemPrompt(): string {
  return [
    'You are a portfolio analysis assistant for personal-use decision support.',
    'Use ONLY the JSON data and rule findings provided. Do not invent prices, quantities, or metrics.',
    'Return STRICT JSON only (no markdown fences) matching the response schema described in the user message.',
    'Prioritise risk, concentration, allocation drift, and data freshness caveats.',
    'You may not contradict severe data-quality gates without explaining degraded reliability.',
  ].join(' ');
}

function buildUserPrompt(input: {
  readonly payload: RecommendationAnalyticsPayload;
  readonly findings: readonly RuleFinding[];
  readonly baseline: BaselineRecommendationResult;
}): string {
  const schemaHint: string = JSON.stringify({
    portfolio_summary: {
      recommendation_type: 'BUY | SELL | HOLD | WATCH',
      headline: 'string',
      rationale: 'string',
      assumptions: 'string',
      strength_score: '0-100 number',
      confidence_score: '0-100 number',
    },
    items: [
      {
        scope_type: 'PORTFOLIO | ASSET',
        asset_id: 'uuid or null',
        recommendation_type: 'BUY | SELL | HOLD | WATCH',
        headline: 'string',
        rationale: 'string',
        assumptions: 'string',
        strength_score: '0-100 number',
        confidence_score: '0-100 number',
        reason_codes: ['RULE_CODE'],
      },
    ],
    disclaimer_note: 'string',
  });
  return [
    `prompt_version: ${AI_PROMPT_VERSION}`,
    `rule_set_version: ${RULE_SET_VERSION}`,
    'analytics_payload:',
    JSON.stringify(input.payload),
    'rule_findings:',
    JSON.stringify(input.findings),
    'deterministic_baseline:',
    JSON.stringify(input.baseline),
    'required_response_shape:',
    schemaHint,
  ].join('\n\n');
}

/** MVP: Anthropic (Claude) only — uses `anthropic-recommendation-llm-adapter`. */
export async function requestRecommendationLlmJson(input: {
  readonly apiKey: string;
  readonly model: string;
  readonly payload: RecommendationAnalyticsPayload;
  readonly findings: readonly RuleFinding[];
  readonly baseline: BaselineRecommendationResult;
}): Promise<string> {
  const system: string = buildSystemPrompt();
  const user: string = buildUserPrompt({
    payload: input.payload,
    findings: input.findings,
    baseline: input.baseline,
  });
  return requestAnthropicRecommendationJson({
    apiKey: input.apiKey,
    model: input.model,
    system,
    user,
  });
}

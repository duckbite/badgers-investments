import { createHash } from 'crypto';
import { DEDUPE_ENGINE_VERSION, RULE_SET_VERSION } from './recommendation-engine-constants.js';
import type { RecommendationAnalyticsPayload } from './recommendation-analytics-payload-types.js';

function sortJsonValue(input: unknown): unknown {
  if (input === null || typeof input !== 'object') {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item) => sortJsonValue(item));
  }
  const record: Record<string, unknown> = input as Record<string, unknown>;
  const keys: string[] = Object.keys(record).sort();
  const sorted: Record<string, unknown> = {};
  for (const key of keys) {
    sorted[key] = sortJsonValue(record[key]);
  }
  return sorted;
}

export type AnalyticsHashInput = {
  readonly configVersionId: string;
  readonly analyticsPayload: RecommendationAnalyticsPayload;
};

/**
 * Stable hash over analytics payload + config version + static engine identifiers for deduplication.
 */
export function computeRecommendationAnalyticsInputHash(input: AnalyticsHashInput): string {
  const body: Record<string, unknown> = {
    dedupe_engine_version: DEDUPE_ENGINE_VERSION,
    rule_set_version: RULE_SET_VERSION,
    config_version_id: input.configVersionId,
    analytics: sortJsonValue(input.analyticsPayload),
  };
  const canonical: string = JSON.stringify(body);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

import type { ApiClient } from './api-client';

export type RecommendationRunSummary = {
  readonly runId: string;
  readonly portfolioId: string;
  readonly runStatus: string;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly analyticsInputHash: string;
  readonly synthesisSource: 'AI' | 'DETERMINISTIC';
  readonly aiStatus: 'OK' | 'FAILED' | 'SKIPPED';
  readonly aiError: string | null;
  readonly aiProvider: string | null;
  readonly aiModel: string | null;
  readonly portfolioLevelSummary: string;
  readonly runItemCount: number;
  readonly runActionableCount: number;
  readonly runMaxStrengthScore: string | null;
};

export type RecommendationFindingDto = {
  readonly findingId: string;
  readonly ruleCode: string;
  readonly severity: string;
  readonly scope: string;
  readonly assetId: string | null;
  readonly message: string;
  readonly metrics: unknown;
};

export type RecommendationItemDto = {
  readonly itemId: string;
  readonly priorityRank: number;
  readonly scopeType: string;
  readonly assetId: string | null;
  readonly recommendationType: string;
  readonly headline: string;
  readonly rationale: string;
  readonly assumptions: string | null;
  readonly strengthScore: string;
  readonly confidenceScore: string;
  readonly reasonCodes: readonly string[];
  readonly source: 'AI' | 'DETERMINISTIC';
};

export type RecommendationRunDetail = RecommendationRunSummary & {
  readonly findings: readonly RecommendationFindingDto[];
  readonly items: readonly RecommendationItemDto[];
};

export async function fetchRecommendationLatestSummary(input: {
  readonly client: ApiClient;
}): Promise<RecommendationRunSummary | null> {
  const body: { readonly run: RecommendationRunSummary | null } = await input.client.executeJson({
    method: 'GET',
    path: '/recommendations/latest-summary',
  });
  return body.run;
}

export async function listRecommendationRuns(input: { readonly client: ApiClient; readonly limit?: number }): Promise<
  readonly RecommendationRunSummary[]
> {
  const body: { readonly items: readonly RecommendationRunSummary[] } = await input.client.executeJson({
    method: 'GET',
    path: '/recommendations/runs',
    query: input.limit !== undefined ? { limit: input.limit } : undefined,
  });
  return body.items;
}

export async function runRecommendation(input: {
  readonly client: ApiClient;
  /**
   * When false, the server may return an existing completed run if portfolio inputs match.
   * Default true: always enqueue a fresh run.
   */
  readonly force?: boolean;
}): Promise<{
  readonly deduped: boolean;
  readonly run: RecommendationRunSummary;
}> {
  const force: boolean = input.force !== false;
  return input.client.executeJson({
    method: 'POST',
    path: '/recommendations/runs',
    body: { force },
  });
}

export async function getRecommendationRunDetail(input: {
  readonly client: ApiClient;
  readonly runId: string;
}): Promise<RecommendationRunDetail> {
  return input.client.executeJson({ method: 'GET', path: `/recommendations/runs/${input.runId}` });
}

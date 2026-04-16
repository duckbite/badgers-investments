import type { ApiClient } from './api-client';

export type AnalysisType =
  | 'stock-screener'
  | 'dcf-valuation'
  | 'risk-assessment'
  | 'earnings-analysis'
  | 'technical-analysis'
  | 'portfolio-builder'
  | 'competitive-analysis'
  | 'macro-impact';

export type AnalysisRunSummary = {
  readonly runId: string;
  readonly portfolioId: string;
  readonly type: AnalysisType;
  readonly status: 'pending' | 'processing' | 'completed' | 'failed';
  readonly createdAt: string;
  readonly completedAt: string | null;
  readonly summary: string;
  readonly reportId: string | null;
  readonly errorMessage: string | null;
};

export type AnalysisReportSummary = {
  readonly reportId: string;
  readonly runId: string;
  readonly type: AnalysisType;
  readonly title: string;
  readonly summary: string;
  readonly createdBy: string;
  readonly createdAt: string;
};

export type AnalysisReportDetail = AnalysisReportSummary & {
  readonly markdownBody: string;
  readonly storageBucket: string | null;
  readonly storageKey: string | null;
};

export async function createAnalysisRun(input: {
  readonly client: ApiClient;
  readonly type: AnalysisType;
  readonly parameters: Record<string, unknown>;
}): Promise<AnalysisRunSummary> {
  const body: { readonly run: AnalysisRunSummary } = await input.client.executeJson({
    method: 'POST',
    path: '/analysis/runs',
    body: { type: input.type, parameters: input.parameters },
  });
  return body.run;
}

export async function listAnalysisRuns(input: {
  readonly client: ApiClient;
  readonly limit?: number;
  readonly type?: AnalysisType;
}): Promise<readonly AnalysisRunSummary[]> {
  const body: { readonly items: readonly AnalysisRunSummary[] } = await input.client.executeJson({
    method: 'GET',
    path: '/analysis/runs',
    query: {
      limit: input.limit,
      type: input.type,
    },
  });
  return body.items;
}

export async function listAnalysisReports(input: {
  readonly client: ApiClient;
  readonly limit?: number;
  readonly type?: AnalysisType | 'all';
  readonly scope?: 'my' | 'all';
  readonly query?: string;
}): Promise<readonly AnalysisReportSummary[]> {
  const body: { readonly items: readonly AnalysisReportSummary[] } = await input.client.executeJson({
    method: 'GET',
    path: '/analysis/reports',
    query: {
      limit: input.limit,
      type: input.type === 'all' ? undefined : input.type,
      scope: input.scope,
      query: input.query,
    },
  });
  return body.items;
}

export async function getAnalysisReport(input: {
  readonly client: ApiClient;
  readonly reportId: string;
}): Promise<AnalysisReportDetail> {
  const body: { readonly report: AnalysisReportDetail } = await input.client.executeJson({
    method: 'GET',
    path: `/analysis/reports/${input.reportId}`,
  });
  return body.report;
}

export async function exportAnalysisReport(input: {
  readonly client: ApiClient;
  readonly reportId: string;
}): Promise<{ readonly fileName: string; readonly format: 'markdown'; readonly content: string }> {
  return input.client.executeJson({
    method: 'GET',
    path: `/analysis/reports/${input.reportId}/export`,
  });
}

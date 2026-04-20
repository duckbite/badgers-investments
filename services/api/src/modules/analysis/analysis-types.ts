export const ANALYSIS_TYPES = [
  'stock-screener',
  'dcf-valuation',
  'risk-assessment',
  'earnings-analysis',
  'technical-analysis',
  'portfolio-builder',
  'competitive-analysis',
  'macro-impact',
] as const;

export type AnalysisType = (typeof ANALYSIS_TYPES)[number];

export type AnalysisStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type AnalysisRunRecord = {
  readonly runId: string;
  readonly portfolioId: string;
  readonly type: AnalysisType;
  readonly status: AnalysisStatus;
  readonly currentStep: string | null;
  readonly parametersJson: string;
  readonly summary: string;
  readonly createdAtIso: string;
  readonly completedAtIso: string | null;
  readonly reportId: string | null;
  readonly errorMessage: string | null;
};

export type AnalysisReportRecord = {
  readonly reportId: string;
  readonly runId: string;
  readonly portfolioId: string;
  readonly type: AnalysisType;
  readonly title: string;
  readonly summary: string;
  readonly markdownBody: string;
  readonly storageBucket: string | null;
  /** Primary markdown object key (legacy single upload) or bundle `report.md` key when bundle fields set. */
  readonly storageKey: string | null;
  /** S3 prefix for report bundle folder: `{type}-{isoUtc}-{subject}/`. */
  readonly storageBundlePrefix: string | null;
  /** Manifest object key (e.g. `technical-analysis-2026-04-18T12:00:00Z-AAPL/manifest.json`). */
  readonly storageManifestKey: string | null;
  readonly createdAtIso: string;
  readonly createdBy: string;
};

export type AnalysisRunSummaryDto = {
  readonly runId: string;
  readonly portfolioId: string;
  readonly type: AnalysisType;
  readonly status: Lowercase<AnalysisStatus>;
  readonly currentStep: string | null;
  readonly createdAt: string;
  readonly completedAt: string | null;
  readonly summary: string;
  readonly reportId: string | null;
  readonly errorMessage: string | null;
};

export type AnalysisReportSummaryDto = {
  readonly reportId: string;
  readonly runId: string;
  readonly type: AnalysisType;
  readonly title: string;
  readonly summary: string;
  readonly createdBy: string;
  readonly createdAt: string;
};

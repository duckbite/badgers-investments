import type { AnalysisType } from './analysis-types.js';

function formatReportFilenameTimestampUtc(isoTimestamp: string): string {
  const parsed: Date = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
  return parsed.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function sanitizeSubjectSegment(raw: string): string {
  const collapsed: string = raw
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/-+/g, '-');
  return collapsed.length > 0 ? collapsed : 'unknown';
}

function buildReportSubjectSegmentForStorage(input: {
  readonly type: AnalysisType;
  readonly parameters: Record<string, unknown>;
}): string {
  if (input.type === 'technical-analysis') {
    const rawSymbol: unknown = input.parameters['symbol'];
    const symbol: string =
      typeof rawSymbol === 'string' ? sanitizeSubjectSegment(rawSymbol.toUpperCase()) : '';
    return symbol.length > 0 ? symbol : 'UNKNOWN';
  }
  if (input.type === 'portfolio-builder') {
    const raw: unknown = input.parameters['riskTolerance'];
    if (typeof raw === 'string') {
      const t: string = raw.trim().toLowerCase();
      if (t === 'conservative' || t === 'moderate' || t === 'aggressive') {
        return t;
      }
    }
    return 'portfolio';
  }
  const rawSymbol: unknown = input.parameters['symbol'];
  if (typeof rawSymbol === 'string' && rawSymbol.trim().length > 0) {
    return sanitizeSubjectSegment(rawSymbol.toUpperCase()).slice(0, 48);
  }
  return 'report';
}

/**
 * S3 object key: `{type}-{isoUtc}-{subject}.md`
 * e.g. `technical-analysis-2026-04-18T14:28:30Z-TSLA.md`
 */
export function buildAnalysisReportStorageObjectKey(input: {
  readonly type: AnalysisType;
  readonly reportTimestampIso: string;
  readonly parameters: Record<string, unknown>;
}): string {
  const iso: string = formatReportFilenameTimestampUtc(input.reportTimestampIso);
  const subject: string = buildReportSubjectSegmentForStorage({
    type: input.type,
    parameters: input.parameters,
  });
  return `${input.type}-${iso}-${subject}.md`;
}

/**
 * S3 prefix for report bundles (every report is a folder): `{type}-{isoUtc}-{subject}/`
 * Contains `report.md`, `manifest.json`, and `assets/*`.
 */
export function buildAnalysisReportBundleFolderPrefix(input: {
  readonly type: AnalysisType;
  readonly reportTimestampIso: string;
  readonly parameters: Record<string, unknown>;
}): string {
  const key: string = buildAnalysisReportStorageObjectKey(input);
  return `${key.replace(/\.md$/, '')}/`;
}

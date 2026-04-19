import { describe, expect, it } from 'vitest';
import {
  buildAnalysisReportBundleFolderPrefix,
  buildAnalysisReportStorageObjectKey,
} from './build-analysis-report-storage-key.js';

describe('buildAnalysisReportStorageObjectKey', () => {
  it('builds technical-analysis key with ISO UTC time and ticker', () => {
    const actual = buildAnalysisReportStorageObjectKey({
      type: 'technical-analysis',
      reportTimestampIso: '2026-04-18T14:28:30.123Z',
      parameters: { symbol: 'tsla' },
    });
    expect(actual).toBe('technical-analysis-2026-04-18T14:28:30Z-TSLA.md');
  });

  it('uses risk tolerance subject for portfolio-builder', () => {
    const actual = buildAnalysisReportStorageObjectKey({
      type: 'portfolio-builder',
      reportTimestampIso: '2026-01-02T03:04:05.000Z',
      parameters: { riskTolerance: 'moderate' },
    });
    expect(actual).toBe('portfolio-builder-2026-01-02T03:04:05Z-moderate.md');
  });

  it('uses report fallback for non-AI analysis types without symbol', () => {
    const actual = buildAnalysisReportStorageObjectKey({
      type: 'stock-screener',
      reportTimestampIso: '2026-04-18T14:28:30.000Z',
      parameters: {},
    });
    expect(actual).toBe('stock-screener-2026-04-18T14:28:30Z-report.md');
  });
});

describe('buildAnalysisReportBundleFolderPrefix', () => {
  it('matches object key basename with trailing slash', () => {
    const actual = buildAnalysisReportBundleFolderPrefix({
      type: 'technical-analysis',
      reportTimestampIso: '2026-04-18T14:28:30.123Z',
      parameters: { symbol: 'tsla' },
    });
    expect(actual).toBe('technical-analysis-2026-04-18T14:28:30Z-TSLA/');
  });
});

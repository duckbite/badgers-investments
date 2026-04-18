import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./fetch-yahoo-instrument-display-name.js', () => ({
  fetchYahooInstrumentDisplayName: vi.fn(() => Promise.resolve('Apple Inc.')),
}));

import { fetchYahooInstrumentDisplayName } from './fetch-yahoo-instrument-display-name.js';
import { buildAnalysisReportSummarySentence } from './build-analysis-report-summary-sentence.js';

describe('buildAnalysisReportSummarySentence', () => {
  beforeEach(() => {
    vi.mocked(fetchYahooInstrumentDisplayName).mockResolvedValue('Apple Inc.');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('builds technical-analysis sentence with Company (TICKER) from Yahoo', async () => {
    const actual: string = await buildAnalysisReportSummarySentence({
      type: 'technical-analysis',
      parameters: { symbol: 'AAPL' },
      markdownBody: '| Timeframe | Trend |\n| --- | --- |',
      fallbackLine: 'ignored',
    });
    expect(actual).toBe(
      'Technical analysis for Apple Inc. (AAPL) covering price action, momentum, volume, and key levels.',
    );
    expect(fetchYahooInstrumentDisplayName).toHaveBeenCalledWith({ symbol: 'AAPL' });
  });

  it('uses portfolio-builder template without table leakage', async () => {
    const actual: string = await buildAnalysisReportSummarySentence({
      type: 'portfolio-builder',
      parameters: { riskTolerance: 'moderate' },
      markdownBody: '| Parameter | Detail |\n| --- | --- |',
      fallbackLine: 'fallback',
    });
    expect(actual).toContain('Portfolio Builder');
    expect(actual).toContain('moderate-risk');
    expect(actual).not.toMatch(/^\|/);
  });

  it('skips leading markdown tables when picking prose for generic types', async () => {
    const actual: string = await buildAnalysisReportSummarySentence({
      type: 'stock-screener',
      parameters: {},
      markdownBody: [
        '| A | B |',
        '| --- | --- |',
        '| x | y |',
        '',
        'This is a longer prose line that should be picked as the summary for the library card.',
      ].join('\n'),
      fallbackLine: 'fallback',
    });
    expect(actual).toContain('This is a longer prose line');
  });
});

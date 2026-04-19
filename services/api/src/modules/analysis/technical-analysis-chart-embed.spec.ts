import { describe, expect, it } from 'vitest';
import {
  appendUnreferencedTechnicalAnalysisChartAppendix,
  collectReferencedTechnicalAnalysisAssetPaths,
  TECHNICAL_ANALYSIS_CHART_ASSET_PATHS,
} from './technical-analysis-chart-embed.js';

describe('collectReferencedTechnicalAnalysisAssetPaths', () => {
  it('detects paths in markdown images', () => {
    const md = 'Hello ![x](assets/rsi-panel.svg) end';
    const s = collectReferencedTechnicalAnalysisAssetPaths(md);
    expect(s.has('assets/rsi-panel.svg')).toBe(true);
  });
});

describe('appendUnreferencedTechnicalAnalysisChartAppendix', () => {
  it('adds Appendix only for assets not referenced', () => {
    const body = '# Hi\n\n![RSI](assets/rsi-panel.svg)\n';
    const out = appendUnreferencedTechnicalAnalysisChartAppendix(body);
    expect(out).toContain('## Appendix');
    const appendix: string = out.split('## Appendix')[1] ?? '';
    expect(appendix).toContain('assets/macd-panel.svg');
    expect(appendix).not.toContain('rsi-panel');
  });

  it('omits Appendix when all charts referenced', () => {
    const lines = TECHNICAL_ANALYSIS_CHART_ASSET_PATHS.map((p) => `![](${p})`).join('\n');
    const out = appendUnreferencedTechnicalAnalysisChartAppendix(lines);
    expect(out).not.toContain('## Appendix');
  });
});

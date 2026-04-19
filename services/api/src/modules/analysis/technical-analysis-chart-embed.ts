/**
 * Deterministic chart paths under `assets/` for technical-analysis bundles (order matches manifest generation).
 */
export const TECHNICAL_ANALYSIS_CHART_ASSET_PATHS: readonly string[] = [
  'assets/price-sparkline.svg',
  'assets/macd-panel.svg',
  'assets/rsi-panel.svg',
  'assets/bollinger-price.svg',
  'assets/volume-panel.svg',
  'assets/obv-panel.svg',
  'assets/moving-averages.svg',
  'assets/atr-panel.svg',
  'assets/fib-levels.svg',
];

const CHART_ALT_BY_PATH: Record<string, string> = {
  'assets/price-sparkline.svg': 'Recent adjusted-close path (sparkline)',
  'assets/macd-panel.svg': 'MACD (12, 26, 9) with histogram',
  'assets/rsi-panel.svg': 'RSI (14)',
  'assets/bollinger-price.svg': 'Price with Bollinger Bands (20, 2σ)',
  'assets/volume-panel.svg': 'Session volume',
  'assets/obv-panel.svg': 'On-balance volume (OBV)',
  'assets/moving-averages.svg': 'Price vs SMA 50 / 100 / 200',
  'assets/atr-panel.svg': 'Average true range (14)',
  'assets/fib-levels.svg': 'Fibonacci retracement levels',
};

/**
 * Finds `assets/…` references already present in markdown (image links, raw paths).
 */
export function collectReferencedTechnicalAnalysisAssetPaths(markdown: string): Set<string> {
  const refs: Set<string> = new Set();
  const re: RegExp = /\bassets\/[a-zA-Z0-9_.-]+\.(?:svg|png)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    refs.add(m[0]);
  }
  return refs;
}

/**
 * Appends an **Appendix** section only with charts the model did not already embed.
 */
export function appendUnreferencedTechnicalAnalysisChartAppendix(markdownBody: string): string {
  const trimmed: string = markdownBody.trim();
  const refs: Set<string> = collectReferencedTechnicalAnalysisAssetPaths(trimmed);
  const missing: string[] = TECHNICAL_ANALYSIS_CHART_ASSET_PATHS.filter((p) => !refs.has(p));
  if (missing.length === 0) {
    return trimmed;
  }
  const blocks: string[] = missing.map((p) => {
    const alt: string = CHART_ALT_BY_PATH[p] ?? 'Chart';
    return `![${alt}](${p})`;
  });
  return [
    trimmed,
    '',
    '---',
    '',
    '## Appendix',
    '',
    '_Deterministic charts not embedded above (same data as the JSON payload)._',
    '',
    ...blocks.flatMap((b) => [b, '']),
  ]
    .join('\n')
    .trimEnd();
}

/**
 * User-prompt block instructing the model to place figures in-context; unplaced assets land in Appendix automatically.
 */
export function buildTechnicalAnalysisChartEmbeddingPromptSection(): string {
  const list: string = TECHNICAL_ANALYSIS_CHART_ASSET_PATHS.map((p) => `- \`${p}\` — ${CHART_ALT_BY_PATH[p] ?? p}`).join('\n');
  return [
    '---',
    '',
    '## Figures (required)',
    '',
    'Pre-generated charts ship with this report under `assets/`. **Embed each figure in the main body** in the chapter where it belongs, using exact Markdown image syntax, e.g. `![RSI (14)](assets/rsi-panel.svg)`. Paths must match **exactly** (case-sensitive).',
    '',
    '**Suggested placement:**',
    '- Trend / overview: `assets/price-sparkline.svg`, `assets/moving-averages.svg`',
    '- Moving averages / crosses: `assets/moving-averages.svg`',
    '- MACD: `assets/macd-panel.svg`',
    '- RSI: `assets/rsi-panel.svg`',
    '- Bollinger Bands: `assets/bollinger-price.svg`',
    '- Volume: `assets/volume-panel.svg`',
    '- OBV: `assets/obv-panel.svg`',
    '- Volatility / position sizing (ATR): `assets/atr-panel.svg`',
    '- Fibonacci / levels: `assets/fib-levels.svg`',
    '',
    'Embed as many as are useful; omit only if redundant. Any path you **do not** embed will be listed automatically under **Appendix**—minimize reliance on that section.',
    '',
    '**Available files:**',
    list,
    '',
  ].join('\n');
}

/**
 * Minimal deterministic SVG polyline from normalized closes (no external render deps).
 */
export function buildPriceSparklineSvg(input: {
  readonly closes: readonly number[];
  readonly width: number;
  readonly height: number;
  readonly title?: string;
  readonly subtitle?: string;
  readonly xAxisLabel?: string;
  readonly yAxisLabel?: string;
}): string {
  const series: number[] = input.closes.filter((x) => Number.isFinite(x)).slice(-90);
  const titleH: number = input.title !== undefined && input.title.length > 0 ? 22 : 0;
  const subH: number = input.subtitle !== undefined && input.subtitle.length > 0 ? 14 : 0;
  const axisH: number = input.xAxisLabel !== undefined && input.xAxisLabel.length > 0 ? 22 : 0;
  const yLabW: number = input.yAxisLabel !== undefined && input.yAxisLabel.length > 0 ? 44 : 0;
  const topPad: number = titleH + subH + (titleH > 0 || subH > 0 ? 4 : 0);
  const w: number = input.width;
  const h: number = input.height;
  const plotLeft: number = yLabW + 6;
  const plotRight: number = w - 8;
  const plotTop: number = topPad;
  const plotBot: number = h - axisH - (axisH > 0 ? 6 : 4);
  const plotW: number = plotRight - plotLeft;
  const plotH: number = plotBot - plotTop;

  function escapeXml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  if (series.length < 2) {
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
      `<rect fill="#f8fafc" width="100%" height="100%"/>`,
      input.title !== undefined ? `<text x="${w / 2}" y="16" text-anchor="middle" font-size="11" fill="#334155">${escapeXml(input.title)}</text>` : '',
      `</svg>`,
    ].join('');
  }
  const min: number = Math.min(...series);
  const max: number = Math.max(...series);
  const span: number = max - min === 0 ? 1 : max - min;
  const pts: string[] = [];
  for (let i: number = 0; i < series.length; i++) {
    const x: number = plotLeft + (i / (series.length - 1)) * plotW;
    const y: number = plotTop + (1 - (series[i] - min) / span) * plotH;
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  const lastY: number = plotTop + (1 - (series[series.length - 1] - min) / span) * plotH;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<rect fill="#f8fafc" width="100%" height="100%"/>`,
  ];
  if (input.title !== undefined && input.title.length > 0) {
    parts.push(`<text x="${w / 2}" y="${16}" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a">${escapeXml(input.title)}</text>`);
  }
  if (input.subtitle !== undefined && input.subtitle.length > 0) {
    parts.push(`<text x="${w / 2}" y="${titleH > 0 ? 30 : 16}" text-anchor="middle" font-size="10" fill="#475569">${escapeXml(input.subtitle)}</text>`);
  }
  if (input.yAxisLabel !== undefined && input.yAxisLabel.length > 0) {
    parts.push(
      `<text x="12" y="${plotTop + plotH / 2}" font-size="9" fill="#64748b" transform="rotate(-90 12 ${plotTop + plotH / 2})" text-anchor="middle">${escapeXml(input.yAxisLabel)}</text>`,
    );
  }
  parts.push(`<text x="${plotLeft - 2}" y="${plotTop + 4}" font-size="9" fill="#64748b" text-anchor="end">${max.toFixed(2)}</text>`);
  parts.push(`<text x="${plotLeft - 2}" y="${plotBot}" font-size="9" fill="#64748b" text-anchor="end">${min.toFixed(2)}</text>`);
  parts.push(`<polyline fill="none" stroke="#4f46e5" stroke-width="1.5" points="${pts.join(' ')}" />`);
  parts.push(
    `<circle cx="${plotLeft + plotW}" cy="${lastY}" r="3" fill="#4f46e5"/><text x="${plotLeft + plotW - 4}" y="${lastY - 6}" font-size="9" fill="#4f46e5" text-anchor="end">${series[series.length - 1].toFixed(2)}</text>`,
  );
  if (input.xAxisLabel !== undefined && input.xAxisLabel.length > 0) {
    parts.push(
      `<text x="${(plotLeft + plotRight) / 2}" y="${h - 6}" text-anchor="middle" font-size="10" fill="#64748b">${escapeXml(input.xAxisLabel)}</text>`,
    );
  }
  parts.push(`</svg>`);
  return parts.join('');
}

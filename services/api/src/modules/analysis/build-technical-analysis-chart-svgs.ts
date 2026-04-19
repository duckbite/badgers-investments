import type { TechnicalAnalysisComputationPayload } from './compute-technical-analysis-payload.js';
import type { TechnicalAnalysisBundleChartContext } from './bundle-chart-context.js';
import { buildPriceSparklineSvg } from './build-sparkline-svg.js';

const W: number = 720;
const PAD: number = 8;
const TOP_TITLE: number = 18;
const SUBTITLE: number = 14;
/** Left gutter for Y-axis value labels */
const FIG_LEFT: number = 52;
/** Bottom gutter for X-axis title */
const FIG_BOTTOM: number = 36;

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function finiteValues(values: readonly number[]): number[] {
  return values.filter((x) => Number.isFinite(x));
}

type YScale = { readonly min: number; readonly max: number; readonly map: (v: number) => number };

function yScale(input: {
  readonly values: readonly number[];
  readonly height: number;
  readonly padTop: number;
  readonly padBottom: number;
}): YScale {
  const f: number[] = finiteValues(input.values);
  if (f.length === 0) {
    return { min: 0, max: 1, map: () => input.padTop };
  }
  let min: number = Math.min(...f);
  let max: number = Math.max(...f);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const inner: number = input.height - input.padTop - input.padBottom;
  return {
    min,
    max,
    map: (v: number): number => {
      if (!Number.isFinite(v)) return Number.NaN;
      return input.padTop + (1 - (v - min) / (max - min)) * inner;
    },
  };
}

function plotRight(): number {
  return W - PAD;
}

function xInPlot(i: number, n: number): number {
  const L: number = FIG_LEFT;
  const R: number = plotRight();
  if (n < 2) return L;
  return L + (i / (n - 1)) * (R - L);
}

function xSeries(n: number): number[] {
  return Array.from({ length: n }, (_, i) => xInPlot(i, n));
}

function polylinePoints(xs: readonly number[], ys: readonly number[], n: number): string {
  const pts: string[] = [];
  for (let i: number = 0; i < n; i++) {
    const x: number = xs[i];
    const y: number = ys[i];
    if (Number.isFinite(x) && Number.isFinite(y)) {
      pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
  }
  return pts.join(' ');
}

function xAxisFooter(h: number, label: string): string {
  return `<text x="${W / 2}" y="${h - 10}" text-anchor="middle" font-size="10" fill="#64748b">${escapeXml(label)}</text>`;
}

function yLabelsLeft(plotTop: number, plotBot: number, scale: YScale, fmt: (v: number) => string): string {
  return [
    `<text x="${FIG_LEFT - 6}" y="${plotTop + 11}" font-size="9" fill="#64748b" text-anchor="end">${escapeXml(fmt(scale.max))}</text>`,
    `<text x="${FIG_LEFT - 6}" y="${plotBot - 2}" font-size="9" fill="#64748b" text-anchor="end">${escapeXml(fmt(scale.min))}</text>`,
  ].join('');
}

const X_SESSIONS = 'Trading sessions (oldest → newest)';

export function buildMacdPanelSvg(ctx: TechnicalAnalysisBundleChartContext): string {
  const n: number = ctx.closes.length;
  const h: number = 252;
  const split: number = 138;
  const lineTop: number = TOP_TITLE + SUBTITLE + 6;
  const lineBot: number = split - 4;
  const lineInner: number = lineBot - lineTop;
  const histTop: number = split + 4;
  const histBot: number = h - FIG_BOTTOM;
  const histInner: number = histBot - histTop;

  const lineVals: number[] = [...ctx.macdLine, ...ctx.macdSignal, 0];
  const ysLine: YScale = yScale({ values: lineVals, height: lineInner, padTop: 0, padBottom: 0 });
  const xs: number[] = xSeries(n);
  const yMacd: number[] = ctx.macdLine.map((v) => lineTop + ysLine.map(v));
  const ySig: number[] = ctx.macdSignal.map((v) => lineTop + ysLine.map(v));
  const yZeroMacd: number = lineTop + ysLine.map(0);

  const histVals: number[] = [...ctx.macdHistogram, 0];
  const ysHist: YScale = yScale({ values: histVals, height: histInner, padTop: 0, padBottom: 0 });
  const yZeroHist: number = histTop + ysHist.map(0);
  const bars: string[] = [];
  const bw: number = Math.max(1.2, (plotRight() - FIG_LEFT) / n - 1);
  for (let i: number = 0; i < n; i++) {
    const v: number = ctx.macdHistogram[i];
    if (!Number.isFinite(v)) continue;
    const y1: number = histTop + ysHist.map(v);
    const top: number = Math.min(yZeroHist, y1);
    const bot: number = Math.max(yZeroHist, y1);
    const x: number = xs[i];
    const fill: string = v >= 0 ? '#16a34a' : '#dc2626';
    bars.push(
      `<rect x="${(x - bw / 2).toFixed(2)}" y="${top.toFixed(2)}" width="${bw.toFixed(2)}" height="${Math.max(1, bot - top).toFixed(2)}" fill="${fill}" opacity="0.88"/>`,
    );
  }
  const lastMacd: number = ctx.macdLine[ctx.macdLine.length - 1] ?? Number.NaN;
  const lastSig: number = ctx.macdSignal[ctx.macdSignal.length - 1] ?? Number.NaN;
  const lastHist: number = ctx.macdHistogram[ctx.macdHistogram.length - 1] ?? Number.NaN;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}">`,
    `<rect fill="#fafafa" width="100%" height="100%"/>`,
    `<text x="${FIG_LEFT}" y="${TOP_TITLE}" font-size="12" font-weight="600" fill="#0f172a">${escapeXml(ctx.symbol)} — MACD (12, 26, 9)</text>`,
    `<text x="${FIG_LEFT}" y="${TOP_TITLE + SUBTITLE}" font-size="9" fill="#64748b">Top: MACD (blue) vs signal (orange); bottom: histogram. Values are dimensionless oscillator units.</text>`,
    `<text x="${plotRight() - 4}" y="${TOP_TITLE + 4}" font-size="9" fill="#2563eb" text-anchor="end">MACD ${Number.isFinite(lastMacd) ? lastMacd.toFixed(4) : '—'}</text>`,
    `<text x="${plotRight() - 4}" y="${TOP_TITLE + 16}" font-size="9" fill="#f97316" text-anchor="end">Sig ${Number.isFinite(lastSig) ? lastSig.toFixed(4) : '—'}</text>`,
    yLabelsLeft(lineTop, lineBot, ysLine, (v) => v.toFixed(3)),
    `<line x1="${FIG_LEFT}" x2="${plotRight()}" y1="${split}" y2="${split}" stroke="#cbd5e1" stroke-width="1"/>`,
    `<line x1="${FIG_LEFT}" x2="${plotRight()}" y1="${yZeroMacd}" y2="${yZeroMacd}" stroke="#94a3b8" stroke-dasharray="4 3" stroke-width="1"/>`,
    `<polyline fill="none" stroke="#2563eb" stroke-width="1.5" points="${polylinePoints(xs, yMacd, n)}" />`,
    `<polyline fill="none" stroke="#f97316" stroke-width="1.2" points="${polylinePoints(xs, ySig, n)}" />`,
    `<line x1="${FIG_LEFT}" x2="${plotRight()}" y1="${yZeroHist}" y2="${yZeroHist}" stroke="#94a3b8" stroke-dasharray="4 3" stroke-width="1"/>`,
    `<text x="${plotRight() - 4}" y="${histTop + 12}" font-size="9" fill="#16a34a" text-anchor="end">Hist ${Number.isFinite(lastHist) ? lastHist.toFixed(4) : '—'}</text>`,
    yLabelsLeft(histTop, histBot, ysHist, (v) => v.toFixed(3)),
    ...bars,
    xAxisFooter(h, X_SESSIONS),
    `</svg>`,
  ].join('');
}

export function buildRsiPanelSvg(ctx: TechnicalAnalysisBundleChartContext): string {
  const n: number = ctx.rsi.length;
  const h: number = 198;
  const plotTop: number = TOP_TITLE + SUBTITLE + 4;
  const plotBot: number = h - FIG_BOTTOM;
  const plotH: number = plotBot - plotTop;
  const ys: YScale = yScale({
    values: [0, 100, ...ctx.rsi],
    height: plotH,
    padTop: 0,
    padBottom: 0,
  });
  const xs: number[] = xSeries(n);
  const yRsi: number[] = ctx.rsi.map((v) => plotTop + ys.map(Math.min(100, Math.max(0, v))));
  const y70: number = plotTop + ys.map(70);
  const y30: number = plotTop + ys.map(30);
  const lastRsi: number = ctx.rsi[ctx.rsi.length - 1] ?? Number.NaN;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}">`,
    `<rect fill="#fafafa" width="100%" height="100%"/>`,
    `<text x="${FIG_LEFT}" y="${TOP_TITLE}" font-size="12" font-weight="600" fill="#0f172a">${escapeXml(ctx.symbol)} — RSI (14)</text>`,
    `<text x="${FIG_LEFT}" y="${TOP_TITLE + SUBTITLE}" font-size="9" fill="#64748b">Y-axis: RSI 0–100 · Shaded: 30–70 band · Dashed: overbought/oversold guides</text>`,
    `<text x="${plotRight() - 4}" y="${TOP_TITLE + 4}" font-size="10" fill="#7c3aed" text-anchor="end">Last RSI ${Number.isFinite(lastRsi) ? lastRsi.toFixed(1) : '—'}</text>`,
    `<text x="${FIG_LEFT - 6}" y="${plotTop + 11}" font-size="9" fill="#64748b" text-anchor="end">100</text>`,
    `<text x="${FIG_LEFT - 6}" y="${plotBot - 2}" font-size="9" fill="#64748b" text-anchor="end">0</text>`,
    `<rect x="${FIG_LEFT}" y="${y70}" width="${plotRight() - FIG_LEFT}" height="${Math.max(0, y30 - y70)}" fill="#fef3c7" opacity="0.45"/>`,
    `<line x1="${FIG_LEFT}" x2="${plotRight()}" y1="${y70}" y2="${y70}" stroke="#eab308" stroke-width="1"/>`,
    `<line x1="${FIG_LEFT}" x2="${plotRight()}" y1="${y30}" y2="${y30}" stroke="#eab308" stroke-width="1"/>`,
    `<text x="${FIG_LEFT + 4}" y="${y70 - 2}" font-size="8" fill="#a16207">70 overbought</text>`,
    `<text x="${FIG_LEFT + 4}" y="${y30 + 10}" font-size="8" fill="#a16207">30 oversold</text>`,
    `<polyline fill="none" stroke="#7c3aed" stroke-width="1.5" points="${polylinePoints(xs, yRsi, n)}" />`,
    xAxisFooter(h, X_SESSIONS),
    `</svg>`,
  ].join('');
}

export function buildBollingerPriceSvg(ctx: TechnicalAnalysisBundleChartContext): string {
  const n: number = ctx.closes.length;
  const h: number = 236;
  const plotTop: number = TOP_TITLE + SUBTITLE + 4;
  const plotBot: number = h - FIG_BOTTOM;
  const plotH: number = plotBot - plotTop;
  const all: number[] = [...ctx.closes, ...ctx.bbUpper, ...ctx.bbMiddle, ...ctx.bbLower];
  const ys: YScale = yScale({ values: all, height: plotH, padTop: 0, padBottom: 0 });
  const xs: number[] = xSeries(n);
  const yClose: number[] = ctx.closes.map((v) => plotTop + ys.map(v));
  const yU: number[] = ctx.bbUpper.map((v) => plotTop + ys.map(v));
  const yM: number[] = ctx.bbMiddle.map((v) => plotTop + ys.map(v));
  const yL: number[] = ctx.bbLower.map((v) => plotTop + ys.map(v));
  let bandFill: string = '';
  for (let i: number = 0; i < n - 1; i++) {
    const x0: number = xs[i];
    const x1: number = xs[i + 1];
    const u0: number = yU[i];
    const u1: number = yU[i + 1];
    const l0: number = yL[i];
    const l1: number = yL[i + 1];
    if ([u0, u1, l0, l1].every(Number.isFinite)) {
      bandFill += `<polygon fill="#e0e7ff" opacity="0.35" points="${x0},${u0} ${x1},${u1} ${x1},${l1} ${x0},${l0}" />`;
    }
  }
  const lc: number = ctx.closes[ctx.closes.length - 1] ?? Number.NaN;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}">`,
    `<rect fill="#fafafa" width="100%" height="100%"/>`,
    `<text x="${FIG_LEFT}" y="${TOP_TITLE}" font-size="12" font-weight="600" fill="#0f172a">${escapeXml(ctx.symbol)} — Price vs Bollinger Bands (20, 2σ)</text>`,
    `<text x="${FIG_LEFT}" y="${TOP_TITLE + SUBTITLE}" font-size="9" fill="#64748b">Y: adjusted close (same scale for price & bands) · Bandwidth = (upper−lower)/middle</text>`,
    `<text x="${plotRight() - 4}" y="${TOP_TITLE + 4}" font-size="9" fill="#4f46e5" text-anchor="end">Close ${Number.isFinite(lc) ? lc.toFixed(2) : '—'}</text>`,
    yLabelsLeft(plotTop, plotBot, ys, (v) => v.toFixed(2)),
    bandFill,
    `<polyline fill="none" stroke="#94a3b8" stroke-width="1" points="${polylinePoints(xs, yU, n)}" />`,
    `<polyline fill="none" stroke="#64748b" stroke-width="1" stroke-dasharray="3 2" points="${polylinePoints(xs, yM, n)}" />`,
    `<polyline fill="none" stroke="#94a3b8" stroke-width="1" points="${polylinePoints(xs, yL, n)}" />`,
    `<polyline fill="none" stroke="#4f46e5" stroke-width="1.8" points="${polylinePoints(xs, yClose, n)}" />`,
    `<text x="${FIG_LEFT}" y="${plotBot + 14}" font-size="9" fill="#64748b">Legend: purple=adj. close · grey upper/lower · dashed=middle (SMA20)</text>`,
    xAxisFooter(h, X_SESSIONS),
    `</svg>`,
  ].join('');
}

export function buildVolumePanelSvg(ctx: TechnicalAnalysisBundleChartContext): string {
  const n: number = ctx.volumes.length;
  const h: number = 176;
  const plotTop: number = TOP_TITLE + SUBTITLE + 4;
  const plotBot: number = h - FIG_BOTTOM;
  const plotH: number = plotBot - plotTop;
  const ys: YScale = yScale({
    values: [0, ...ctx.volumes],
    height: plotH,
    padTop: 0,
    padBottom: 0,
  });
  const xs: number[] = xSeries(n);
  const y0: number = plotTop + ys.map(0);
  const bw: number = Math.max(1.2, (plotRight() - FIG_LEFT) / n - 1);
  const bars: string[] = [];
  const vmax: number = Math.max(...finiteValues(ctx.volumes), 1);
  const lastV: number = ctx.volumes[ctx.volumes.length - 1] ?? Number.NaN;
  for (let i: number = 0; i < n; i++) {
    const vol: number = ctx.volumes[i];
    if (!Number.isFinite(vol)) continue;
    const o: number = ctx.opens[i];
    const c: number = ctx.closes[i];
    const yb: number = plotTop + ys.map(vol);
    const top: number = Math.min(yb, y0);
    const bot: number = Math.max(yb, y0);
    const x: number = xs[i];
    const fill: string = c >= o ? '#22c55e' : '#ef4444';
    bars.push(
      `<rect x="${(x - bw / 2).toFixed(2)}" y="${top.toFixed(2)}" width="${bw.toFixed(2)}" height="${Math.max(1, bot - top).toFixed(2)}" fill="${fill}" opacity="0.9"/>`,
    );
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}">`,
    `<rect fill="#fafafa" width="100%" height="100%"/>`,
    `<text x="${FIG_LEFT}" y="${TOP_TITLE}" font-size="12" font-weight="600" fill="#0f172a">${escapeXml(ctx.symbol)} — Volume</text>`,
    `<text x="${FIG_LEFT}" y="${TOP_TITLE + SUBTITLE}" font-size="9" fill="#64748b">Y: shares traded per session · Green=up day, red=down day (vs open)</text>`,
    `<text x="${plotRight() - 4}" y="${TOP_TITLE + 4}" font-size="9" fill="#334155" text-anchor="end">Max ${vmax.toLocaleString('en-US')} · Last ${Number.isFinite(lastV) ? lastV.toLocaleString('en-US') : '—'}</text>`,
    yLabelsLeft(plotTop, plotBot, ys, (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v.toLocaleString('en-US', { maximumFractionDigits: 0 }))),
    ...bars,
    xAxisFooter(h, X_SESSIONS),
    `</svg>`,
  ].join('');
}

export function buildObvPanelSvg(ctx: TechnicalAnalysisBundleChartContext): string {
  const n: number = ctx.obv.length;
  const h: number = 176;
  const plotTop: number = TOP_TITLE + SUBTITLE + 4;
  const plotBot: number = h - FIG_BOTTOM;
  const plotH: number = plotBot - plotTop;
  const ys: YScale = yScale({ values: ctx.obv, height: plotH, padTop: 0, padBottom: 0 });
  const xs: number[] = xSeries(n);
  const yObv: number[] = ctx.obv.map((v) => plotTop + ys.map(v));
  const lastO: number = ctx.obv[ctx.obv.length - 1] ?? Number.NaN;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}">`,
    `<rect fill="#fafafa" width="100%" height="100%"/>`,
    `<text x="${FIG_LEFT}" y="${TOP_TITLE}" font-size="12" font-weight="600" fill="#0f172a">${escapeXml(ctx.symbol)} — OBV (cumulative)</text>`,
    `<text x="${FIG_LEFT}" y="${TOP_TITLE + SUBTITLE}" font-size="9" fill="#64748b">Y-axis: on-balance volume (running sum, arbitrary scale; slope matters)</text>`,
    `<text x="${plotRight() - 4}" y="${TOP_TITLE + 4}" font-size="9" fill="#0d9488" text-anchor="end">Last ${Number.isFinite(lastO) ? lastO.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—'}</text>`,
    yLabelsLeft(plotTop, plotBot, ys, (v) => v.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })),
    `<polyline fill="none" stroke="#0d9488" stroke-width="1.5" points="${polylinePoints(xs, yObv, n)}" />`,
    xAxisFooter(h, X_SESSIONS),
    `</svg>`,
  ].join('');
}

export function buildMovingAveragesSvg(ctx: TechnicalAnalysisBundleChartContext): string {
  const n: number = ctx.closes.length;
  const h: number = 236;
  const plotTop: number = TOP_TITLE + SUBTITLE + 4;
  const plotBot: number = h - FIG_BOTTOM;
  const plotH: number = plotBot - plotTop;
  const all: number[] = [...ctx.closes, ...ctx.sma50, ...ctx.sma100, ...ctx.sma200];
  const ys: YScale = yScale({ values: all, height: plotH, padTop: 0, padBottom: 0 });
  const xs: number[] = xSeries(n);
  const yC: number[] = ctx.closes.map((v) => plotTop + ys.map(v));
  const y50: number[] = ctx.sma50.map((v) => plotTop + ys.map(v));
  const y100: number[] = ctx.sma100.map((v) => plotTop + ys.map(v));
  const y200: number[] = ctx.sma200.map((v) => plotTop + ys.map(v));
  const c0: number = ctx.closes[ctx.closes.length - 1] ?? Number.NaN;
  const s50: number = ctx.sma50[ctx.sma50.length - 1] ?? Number.NaN;
  const s100: number = ctx.sma100[ctx.sma100.length - 1] ?? Number.NaN;
  const s200: number = ctx.sma200[ctx.sma200.length - 1] ?? Number.NaN;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}">`,
    `<rect fill="#fafafa" width="100%" height="100%"/>`,
    `<text x="${FIG_LEFT}" y="${TOP_TITLE}" font-size="12" font-weight="600" fill="#0f172a">${escapeXml(ctx.symbol)} — Price vs SMA 50 / 100 / 200</text>`,
    `<text x="${FIG_LEFT}" y="${TOP_TITLE + SUBTITLE}" font-size="9" fill="#64748b">Y: adjusted close &amp; simple moving averages (same price scale)</text>`,
    `<text x="${plotRight() - 4}" y="${TOP_TITLE + 2}" font-size="8" fill="#1e293b" text-anchor="end">C ${Number.isFinite(c0) ? c0.toFixed(2) : '—'}</text>`,
    `<text x="${plotRight() - 4}" y="${TOP_TITLE + 12}" font-size="8" fill="#64748b" text-anchor="end">50 ${Number.isFinite(s50) ? s50.toFixed(2) : '—'}</text>`,
    `<text x="${plotRight() - 4}" y="${TOP_TITLE + 22}" font-size="8" fill="#94a3b8" text-anchor="end">100 ${Number.isFinite(s100) ? s100.toFixed(2) : '—'}</text>`,
    `<text x="${plotRight() - 4}" y="${TOP_TITLE + 32}" font-size="8" fill="#cbd5e1" text-anchor="end">200 ${Number.isFinite(s200) ? s200.toFixed(2) : '—'}</text>`,
    yLabelsLeft(plotTop, plotBot, ys, (v) => v.toFixed(2)),
    `<polyline fill="none" stroke="#cbd5e1" stroke-width="1.2" points="${polylinePoints(xs, y200, n)}" />`,
    `<polyline fill="none" stroke="#94a3b8" stroke-width="1.2" points="${polylinePoints(xs, y100, n)}" />`,
    `<polyline fill="none" stroke="#64748b" stroke-width="1.2" points="${polylinePoints(xs, y50, n)}" />`,
    `<polyline fill="none" stroke="#1e293b" stroke-width="1.8" points="${polylinePoints(xs, yC, n)}" />`,
    `<text x="${FIG_LEFT}" y="${plotBot + 14}" font-size="9" fill="#64748b">Black=adj. close · SMA50/100/200 light→dark grey</text>`,
    xAxisFooter(h, X_SESSIONS),
    `</svg>`,
  ].join('');
}

export function buildAtrPanelSvg(ctx: TechnicalAnalysisBundleChartContext): string {
  const n: number = ctx.atr.length;
  const h: number = 156;
  const plotTop: number = TOP_TITLE + SUBTITLE + 4;
  const plotBot: number = h - FIG_BOTTOM;
  const plotH: number = plotBot - plotTop;
  const ys: YScale = yScale({ values: ctx.atr, height: plotH, padTop: 0, padBottom: 0 });
  const xs: number[] = xSeries(n);
  const yA: number[] = ctx.atr.map((v) => plotTop + ys.map(v));
  const lastA: number = ctx.atr[ctx.atr.length - 1] ?? Number.NaN;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}">`,
    `<rect fill="#fafafa" width="100%" height="100%"/>`,
    `<text x="${FIG_LEFT}" y="${TOP_TITLE}" font-size="12" font-weight="600" fill="#0f172a">${escapeXml(ctx.symbol)} — ATR (14, Wilder)</text>`,
    `<text x="${FIG_LEFT}" y="${TOP_TITLE + SUBTITLE}" font-size="9" fill="#64748b">Y: average true range in price units (volatility of range, not direction)</text>`,
    `<text x="${plotRight() - 4}" y="${TOP_TITLE + 4}" font-size="9" fill="#b45309" text-anchor="end">Last ATR ${Number.isFinite(lastA) ? lastA.toFixed(3) : '—'}</text>`,
    yLabelsLeft(plotTop, plotBot, ys, (v) => v.toFixed(3)),
    `<polyline fill="none" stroke="#b45309" stroke-width="1.5" points="${polylinePoints(xs, yA, n)}" />`,
    xAxisFooter(h, X_SESSIONS),
    `</svg>`,
  ].join('');
}

export function buildFibLevelsSvg(input: {
  readonly symbol: string;
  readonly fib: TechnicalAnalysisComputationPayload['levels']['fib'];
  readonly lastClose: number;
}): string {
  const { fib, lastClose } = input;
  const h: number = 200;
  const plotTop: number = TOP_TITLE + SUBTITLE + 8;
  const plotBot: number = h - FIG_BOTTOM;
  const plotH: number = plotBot - plotTop;
  const levels: { readonly label: string; readonly price: number }[] = [
    { label: '23.6%', price: fib.levels236 },
    { label: '38.2%', price: fib.levels382 },
    { label: '50%', price: fib.levels500 },
    { label: '61.8%', price: fib.levels618 },
    { label: '78.6%', price: fib.levels786 },
  ];
  const ys: YScale = yScale({
    values: [fib.swingLow, fib.swingHigh, lastClose, ...levels.map((l) => l.price)],
    height: plotH,
    padTop: 0,
    padBottom: 0,
  });
  const lines: string[] = [];
  for (const l of levels) {
    const y: number = plotTop + ys.map(l.price);
    if (!Number.isFinite(y)) continue;
    lines.push(
      `<line x1="${FIG_LEFT}" x2="${plotRight()}" y1="${y}" y2="${y}" stroke="#6366f1" stroke-width="1" stroke-dasharray="4 2"/>`,
    );
    lines.push(
      `<text x="${plotRight() - 4}" y="${y - 2}" font-size="9" fill="#475569" text-anchor="end">${escapeXml(l.label)} @ ${l.price.toFixed(2)}</text>`,
    );
  }
  const ySpot: number = plotTop + ys.map(lastClose);
  if (Number.isFinite(ySpot)) {
    lines.push(`<line x1="${FIG_LEFT}" x2="${plotRight()}" y1="${ySpot}" y2="${ySpot}" stroke="#dc2626" stroke-width="1.5"/>`);
    lines.push(
      `<text x="${FIG_LEFT}" y="${ySpot - 4}" font-size="10" fill="#dc2626">Last close ${lastClose.toFixed(2)}</text>`,
    );
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}">`,
    `<rect fill="#fafafa" width="100%" height="100%"/>`,
    `<text x="${FIG_LEFT}" y="${TOP_TITLE}" font-size="12" font-weight="600" fill="#0f172a">${escapeXml(input.symbol)} — Fibonacci retracements</text>`,
    `<text x="${FIG_LEFT}" y="${TOP_TITLE + SUBTITLE}" font-size="9" fill="#64748b">Y-axis: price · Levels from last completed fractal swing (see payload) · Red = spot last close</text>`,
    yLabelsLeft(plotTop, plotBot, ys, (v) => v.toFixed(2)),
    ...lines,
    xAxisFooter(h, 'Price (horizontal levels)'),
    `</svg>`,
  ].join('');
}

/**
 * All chart/diagram SVGs for the TA bundle (stored under assets/ whether or not inlined in report.md).
 */
export function buildTechnicalAnalysisChartAssetSvgs(input: {
  readonly chartContext: TechnicalAnalysisBundleChartContext;
  readonly fib: TechnicalAnalysisComputationPayload['levels']['fib'];
  readonly lastClose: number;
}): Record<string, string> {
  const { chartContext, fib, lastClose } = input;
  const out: Record<string, string> = {};
  const lastAdj: number = chartContext.closes[chartContext.closes.length - 1] ?? Number.NaN;
  out['assets/price-sparkline.svg'] = buildPriceSparklineSvg({
    closes: chartContext.closes,
    width: W,
    height: 152,
    title: `${chartContext.symbol} — recent sessions (adj. close)`,
    subtitle: Number.isFinite(lastAdj) ? `Last: ${lastAdj.toFixed(2)}` : undefined,
    xAxisLabel: X_SESSIONS,
    yAxisLabel: 'Price',
  });
  out['assets/macd-panel.svg'] = buildMacdPanelSvg(chartContext);
  out['assets/rsi-panel.svg'] = buildRsiPanelSvg(chartContext);
  out['assets/bollinger-price.svg'] = buildBollingerPriceSvg(chartContext);
  out['assets/volume-panel.svg'] = buildVolumePanelSvg(chartContext);
  out['assets/obv-panel.svg'] = buildObvPanelSvg(chartContext);
  out['assets/moving-averages.svg'] = buildMovingAveragesSvg(chartContext);
  out['assets/atr-panel.svg'] = buildAtrPanelSvg(chartContext);
  out['assets/fib-levels.svg'] = buildFibLevelsSvg({ symbol: chartContext.symbol, fib, lastClose });
  return out;
}

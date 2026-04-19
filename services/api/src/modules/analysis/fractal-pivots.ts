import { AnalysisComputationError } from './analysis-computation-error.js';

/**
 * Fractal swing highs/lows (same 2k+1 window as AC7 support/resistance).
 * Indices are bar indices into the aligned daily series.
 */
export type FractalPivot = { readonly index: number; readonly price: number };

export function collectFractalPivotHighs(input: { readonly highs: readonly number[]; readonly k: number }): FractalPivot[] {
  const { highs, k } = input;
  const out: FractalPivot[] = [];
  for (let i: number = k; i < highs.length - k; i++) {
    const center: number = highs[i];
    if (!Number.isFinite(center)) {
      continue;
    }
    let isMax: boolean = true;
    for (let j: number = i - k; j <= i + k; j++) {
      if (j === i) {
        continue;
      }
      const v: number = highs[j];
      if (v >= center) {
        isMax = false;
        break;
      }
    }
    if (isMax) {
      out.push({ index: i, price: center });
    }
  }
  return out;
}

export function collectFractalPivotLows(input: { readonly lows: readonly number[]; readonly k: number }): FractalPivot[] {
  const { lows, k } = input;
  const out: FractalPivot[] = [];
  for (let i: number = k; i < lows.length - k; i++) {
    const center: number = lows[i];
    if (!Number.isFinite(center)) {
      continue;
    }
    let isMin: boolean = true;
    for (let j: number = i - k; j <= i + k; j++) {
      if (j === i) {
        continue;
      }
      const v: number = lows[j];
      if (v <= center) {
        isMin = false;
        break;
      }
    }
    if (isMin) {
      out.push({ index: i, price: center });
    }
  }
  return out;
}

function minInRange(values: readonly number[], endInclusive: number): number {
  let m: number = Number.POSITIVE_INFINITY;
  for (let i: number = 0; i <= endInclusive && i < values.length; i++) {
    const v: number = values[i];
    if (Number.isFinite(v) && v < m) {
      m = v;
    }
  }
  return m;
}

function maxInRange(values: readonly number[], endInclusive: number): number {
  let m: number = Number.NEGATIVE_INFINITY;
  for (let i: number = 0; i <= endInclusive && i < values.length; i++) {
    const v: number = values[i];
    if (Number.isFinite(v) && v > m) {
      m = v;
    }
  }
  return m;
}

/**
 * Industry-standard automated Fib: same fractals as S/R (AC7), anchors the **last completed impulse** —
 * if the latest swing is a high, use the most recent swing low before it to that high; if the latest swing is a low,
 * use the most recent swing high before it to that low (mirrors how practitioners draw a single retracement leg).
 * If fractals do not yet exist before the terminal swing, falls back to the segment low/high (same bar range).
 */
export function selectFibonacciSwingFromFractals(input: {
  readonly fractalHighs: readonly FractalPivot[];
  readonly fractalLows: readonly FractalPivot[];
  readonly dailyHighs: readonly number[];
  readonly dailyLows: readonly number[];
}): { readonly swingLow: number; readonly swingHigh: number } {
  const { fractalHighs, fractalLows, dailyHighs, dailyLows } = input;
  if (fractalHighs.length === 0 || fractalLows.length === 0) {
    const lo: number = minInRange(dailyLows, dailyLows.length - 1);
    const hi: number = maxInRange(dailyHighs, dailyHighs.length - 1);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo >= hi) {
      throw new AnalysisComputationError('Fibonacci: cannot derive swing range from data.');
    }
    return { swingLow: lo, swingHigh: hi };
  }

  const lastHigh: FractalPivot = fractalHighs.reduce((a, b) => (b.index > a.index ? b : a));
  const lastLow: FractalPivot = fractalLows.reduce((a, b) => (b.index > a.index ? b : a));

  if (lastHigh.index > lastLow.index) {
    const lowsBefore: FractalPivot[] = fractalLows.filter((p) => p.index < lastHigh.index);
    const swingLowPrice: number =
      lowsBefore.length > 0
        ? lowsBefore.reduce((a, b) => (b.index > a.index ? b : a)).price
        : minInRange(dailyLows, lastHigh.index);
    const swingHighPrice: number = lastHigh.price;
    if (!Number.isFinite(swingLowPrice) || !Number.isFinite(swingHighPrice) || swingLowPrice >= swingHighPrice) {
      throw new AnalysisComputationError('Fibonacci: invalid up-leg swing range.');
    }
    return { swingLow: swingLowPrice, swingHigh: swingHighPrice };
  }

  const highsBefore: FractalPivot[] = fractalHighs.filter((p) => p.index < lastLow.index);
  const swingHighPrice: number =
    highsBefore.length > 0
      ? highsBefore.reduce((a, b) => (b.index > a.index ? b : a)).price
      : maxInRange(dailyHighs, lastLow.index);
  const swingLowPrice: number = lastLow.price;
  if (!Number.isFinite(swingLowPrice) || !Number.isFinite(swingHighPrice) || swingLowPrice >= swingHighPrice) {
    throw new AnalysisComputationError('Fibonacci: invalid down-leg swing range.');
  }
  return { swingLow: swingLowPrice, swingHigh: swingHighPrice };
}

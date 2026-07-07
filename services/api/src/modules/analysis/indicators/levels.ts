export type FibLevels = {
  readonly swingHigh: number;
  readonly swingLow: number;
  readonly levels236: number;
  readonly levels382: number;
  readonly levels500: number;
  readonly levels618: number;
  readonly levels786: number;
};

export type LevelsResult = {
  readonly resistanceUpTo3: readonly number[];
  readonly supportUpTo3: readonly number[];
  readonly fib: FibLevels;
};

export function computeLevels(input: {
  readonly pivotHighs: readonly number[];
  readonly pivotLows: readonly number[];
  readonly currentPrice: number;
  readonly swingHigh: number;
  readonly swingLow: number;
}): LevelsResult {
  const { pivotHighs, pivotLows, currentPrice, swingHigh, swingLow } = input;
  const above: number[] = [...new Set(pivotHighs.filter((p) => p > currentPrice && Number.isFinite(p)))].sort((a, b) => a - b);
  const below: number[] = [...new Set(pivotLows.filter((p) => p < currentPrice && Number.isFinite(p)))].sort((a, b) => b - a);
  const span: number = swingHigh - swingLow;
  return {
    resistanceUpTo3: above.slice(0, 3),
    supportUpTo3: below.slice(0, 3),
    fib: {
      swingHigh,
      swingLow,
      levels236: swingLow + span * 0.236,
      levels382: swingLow + span * 0.382,
      levels500: swingLow + span * 0.5,
      levels618: swingLow + span * 0.618,
      levels786: swingLow + span * 0.786,
    },
  };
}

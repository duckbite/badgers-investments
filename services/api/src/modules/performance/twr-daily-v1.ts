import { Decimal } from 'decimal.js';

export type DailyTwrPoint = {
  readonly periodDate: string;
  readonly valuationStartAmount: string;
  readonly valuationEndAmount: string;
  readonly subperiodReturn: string;
  readonly cumulativeTwrReturn: string;
};

export type PortfolioValuePoint = {
  readonly snapshotDate: string;
  readonly totalMarketValueAmount: string;
};

const CALCULATION_METHOD: string = 'TWR_DAILY_V1';
const CALCULATION_VERSION: string = '1';

export function getTwrDailyV1Metadata(): { readonly calculationMethod: string; readonly calculationVersion: string } {
  return { calculationMethod: CALCULATION_METHOD, calculationVersion: CALCULATION_VERSION };
}

/**
 * Chains daily holding-period returns from end-of-day portfolio values.
 * External cash flows are not applied in this MVP slice; subperiod return is V_t / V_{t-1} - 1 when V_{t-1} > 0.
 */
export function computeDailyTwrChain(input: { readonly values: readonly PortfolioValuePoint[] }): readonly DailyTwrPoint[] {
  const sorted: PortfolioValuePoint[] = input.values.slice().sort((left, right) => left.snapshotDate.localeCompare(right.snapshotDate));
  if (sorted.length === 0) {
    return [];
  }
  const points: DailyTwrPoint[] = [];
  let cumulativeFactor: Decimal = new Decimal(1);
  let previousValue: Decimal | undefined;
  let previousDate: string | undefined;
  for (const row of sorted) {
    const endVal: Decimal = new Decimal(row.totalMarketValueAmount);
    if (previousValue === undefined || previousDate === undefined) {
      previousValue = endVal;
      previousDate = row.snapshotDate;
      continue;
    }
    const startVal: Decimal = previousValue;
    let hpFactor: Decimal;
    if (startVal.lte(0)) {
      hpFactor = new Decimal(1);
    } else {
      hpFactor = endVal.div(startVal);
    }
    cumulativeFactor = cumulativeFactor.mul(hpFactor);
    const subperiodReturn: Decimal = hpFactor.sub(1);
    const cumulativeTwrReturn: Decimal = cumulativeFactor.sub(1);
    points.push({
      periodDate: row.snapshotDate,
      valuationStartAmount: startVal.toFixed(),
      valuationEndAmount: endVal.toFixed(),
      subperiodReturn: subperiodReturn.toFixed(),
      cumulativeTwrReturn: cumulativeTwrReturn.toFixed(),
    });
    previousValue = endVal;
    previousDate = row.snapshotDate;
  }
  void previousDate;
  return points;
}

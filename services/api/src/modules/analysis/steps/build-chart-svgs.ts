import { buildTechnicalAnalysisChartAssetSvgs } from '../build-technical-analysis-chart-svgs.js';
import type { TechnicalAnalysisBundleChartContext } from '../bundle-chart-context.js';
import type { TechnicalAnalysisComputationPayload } from '../compute-technical-analysis-payload.js';

export { buildTechnicalAnalysisChartAssetSvgs as buildChartSvgs };

export type BuildChartSvgsInput = {
  readonly chartContext: TechnicalAnalysisBundleChartContext;
  readonly payload: TechnicalAnalysisComputationPayload;
};

export function buildChartSvgsFromPayload(input: BuildChartSvgsInput): Record<string, string> {
  return buildTechnicalAnalysisChartAssetSvgs({
    chartContext: input.chartContext,
    fib: input.payload.levels.fib,
    lastClose: input.payload.quote.regularMarketPrice,
  });
}

import type { FastifyBaseLogger } from 'fastify';
import type { TechnicalAnalysisBundleChartContext } from './bundle-chart-context.js';
import {
  computeTechnicalAnalysisPayload,
  logSanitizedTechnicalPayloadSummary,
  type TechnicalAnalysisComputationPayload,
} from './compute-technical-analysis-payload.js';
import {
  buildTechnicalAnalysisChartEmbeddingPromptSection,
} from './technical-analysis-chart-embed.js';

export type TechnicalAnalysisInput = {
  readonly symbol: string;
  readonly includePosition: boolean;
};

export const TECHNICAL_ANALYSIS_SYSTEM_PROMPT =
  'You are a senior quantitative trader writing actionable markdown investment reports. Structure the document with clear section headings; embed pre-generated chart images from the user message (`assets/*.svg`) in the chapters where they belong (momentum, volume, levels, etc.). Return markdown only.';

export function parseTechnicalAnalysisInput(input: { readonly parameters: Record<string, unknown> }): TechnicalAnalysisInput {
  const rawSymbol: unknown = input.parameters['symbol'];
  const rawIncludePosition: unknown = input.parameters['includePosition'];
  const symbol: string = typeof rawSymbol === 'string' ? rawSymbol.trim().toUpperCase() : '';
  if (symbol.length === 0) {
    throw new Error('Ticker symbol is required for technical analysis.');
  }
  return {
    symbol,
    includePosition: rawIncludePosition === true,
  };
}

export function buildTechnicalAnalysisPrompt(input: { readonly input: TechnicalAnalysisInput }): string {
  const positionClause: string = input.input.includePosition
    ? `Current position context: Include current holdings context for ${input.input.symbol} if available.`
    : `Current position context: Ignore portfolio position context and analyze ${input.input.symbol} standalone.`;
  return `You are a senior quantitative trader at Badgers Finance who combines technical analysis with statistical models to time entries and exits.

I need a full technical analysis breakdown of a stock.

Analyze:

* Current trend direction on daily, weekly, and monthly timeframes
* Key support and resistance levels with exact price points
* Moving average analysis (50-day, 100-day, 200-day) and crossover signals
* RSI, MACD, and Bollinger Band readings with plain-English interpretation
* Volume trend analysis and what it signals about buyer vs seller strength
* Chart pattern identification (head and shoulders, cup and handle, etc.)
* Fibonacci retracement levels for potential bounce zones
* Ideal entry price, stop-loss level, and profit target
* Risk-to-reward ratio for the current setup
* Confidence rating: strong buy, buy, neutral, sell, strong sell

Format as a technical analysis report card with a clear trade plan summary. Store as Markdown document.

The stock to analyze: ${input.input.symbol}
${positionClause}`;
}

export async function prepareTechnicalAnalysisLlmContext(input: {
  readonly parameters: Record<string, unknown>;
  readonly now: Date;
  readonly log: FastifyBaseLogger;
}): Promise<{
  readonly prompt: string;
  readonly technicalPayload: TechnicalAnalysisComputationPayload;
  readonly technicalChartContext: TechnicalAnalysisBundleChartContext;
}> {
  const parsed: TechnicalAnalysisInput = parseTechnicalAnalysisInput({ parameters: input.parameters });
  const computed = await computeTechnicalAnalysisPayload({ symbol: parsed.symbol, now: input.now });
  logSanitizedTechnicalPayloadSummary({ payload: computed.payload, log: input.log });
  const basePrompt: string = buildTechnicalAnalysisPrompt({ input: parsed });
  const prompt: string = `${basePrompt}\n\n---\n\n## Deterministic computed market payload (JSON)\n\nUse these figures as ground truth for prices, indicators, and levels. Do not invent conflicting numbers.\n\n\`\`\`json\n${JSON.stringify(computed.payload)}\n\`\`\`\n\n${buildTechnicalAnalysisChartEmbeddingPromptSection()}`;
  return {
    prompt,
    technicalPayload: computed.payload,
    technicalChartContext: computed.chartContext,
  };
}

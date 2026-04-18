import type { AnalysisType } from './analysis-types.js';
import { fetchYahooInstrumentDisplayName } from './fetch-yahoo-instrument-display-name.js';

function isLikelyMarkdownTableLine(line: string): boolean {
  const trimmed: string = line.trim();
  return trimmed.startsWith('|') && trimmed.includes('|');
}

function isHorizontalRuleOrTableSep(line: string): boolean {
  const t: string = line.trim();
  return /^[\s|:-]+$/.test(t) && t.includes('-');
}

/**
 * Picks the first substantial prose line, skipping headings, lists, fences, and markdown tables.
 */
export function pickFirstProseLineFromReportMarkdown(markdown: string): string | undefined {
  const lines: readonly string[] = markdown.split('\n');
  let inFence: boolean = false;
  for (const raw of lines) {
    const line: string = raw.trim();
    if (line.length === 0) {
      continue;
    }
    if (line.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }
    if (line.startsWith('#')) {
      continue;
    }
    if (isLikelyMarkdownTableLine(line) || isHorizontalRuleOrTableSep(line)) {
      continue;
    }
    if (/^[-*+]\s/.test(line)) {
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      continue;
    }
    if (line.length < 24) {
      continue;
    }
    return line.length > 280 ? `${line.slice(0, 277)}…` : line;
  }
  return undefined;
}

function parseSymbolFromParameters(parameters: Record<string, unknown>): string | undefined {
  const raw: unknown = parameters['symbol'];
  if (typeof raw !== 'string') {
    return undefined;
  }
  const s: string = raw.trim().toUpperCase();
  return s.length > 0 ? s : undefined;
}

function parseRiskToleranceLabel(parameters: Record<string, unknown>): string {
  const raw: unknown = parameters['riskTolerance'];
  if (typeof raw !== 'string') {
    return 'moderate';
  }
  const t: string = raw.trim().toLowerCase();
  if (t === 'conservative' || t === 'moderate' || t === 'aggressive') {
    return t;
  }
  return 'moderate';
}

/**
 * One-sentence Library card summary. Technical analysis uses Yahoo for issuer name plus ticker in parentheses.
 */
export async function buildAnalysisReportSummarySentence(input: {
  readonly type: AnalysisType;
  readonly parameters: Record<string, unknown>;
  readonly markdownBody: string;
  readonly fallbackLine: string;
}): Promise<string> {
  if (input.type === 'technical-analysis') {
    const symbol: string | undefined = parseSymbolFromParameters(input.parameters);
    if (symbol === undefined) {
      return input.fallbackLine;
    }
    const displayName: string = await fetchYahooInstrumentDisplayName({ symbol });
    return `Technical analysis for ${displayName} (${symbol}) covering price action, momentum, volume, and key levels.`;
  }
  if (input.type === 'portfolio-builder') {
    const risk: string = parseRiskToleranceLabel(input.parameters);
    return `Portfolio Builder: a ${risk}-risk investment policy with allocation targets, fund ideas, rebalancing, and benchmarks tailored to your profile.`;
  }
  const maybeSymbol: string | undefined = parseSymbolFromParameters(input.parameters);
  if (maybeSymbol !== undefined) {
    const displayName: string = await fetchYahooInstrumentDisplayName({ symbol: maybeSymbol });
    return `Analysis report for ${displayName} (${maybeSymbol}) based on your inputs and the generated markdown.`;
  }
  const prose: string | undefined = pickFirstProseLineFromReportMarkdown(input.markdownBody);
  if (prose !== undefined) {
    return prose;
  }
  return input.fallbackLine;
}

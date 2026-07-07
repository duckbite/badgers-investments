import type { LlmCredentials } from '../steps/call-analysis-llm.js';
import { callAnalysisLlm } from '../steps/call-analysis-llm.js';

export const PORTFOLIO_BUILDER_SYSTEM_PROMPT =
  'You are a senior quantitative trader writing actionable markdown investment reports. Return markdown only.';

export type PortfolioBuilderInput = {
  readonly age: number;
  readonly income: number;
  readonly savings: number;
  readonly goals: string;
  readonly riskTolerance: 'conservative' | 'moderate' | 'aggressive';
};

export function parsePortfolioBuilderInput(input: { readonly parameters: Record<string, unknown> }): PortfolioBuilderInput {
  const age: number = parseRequiredNumber({ value: input.parameters['age'], label: 'Age' });
  const income: number = parseRequiredNumber({ value: input.parameters['income'], label: 'Annual income' });
  const savings: number = parseRequiredNumber({ value: input.parameters['savings'], label: 'Available savings' });
  const goals: string = typeof input.parameters['goals'] === 'string' ? input.parameters['goals'].trim() : '';
  const riskToleranceRaw: string =
    typeof input.parameters['riskTolerance'] === 'string' ? input.parameters['riskTolerance'].trim().toLowerCase() : '';
  if (riskToleranceRaw !== 'conservative' && riskToleranceRaw !== 'moderate' && riskToleranceRaw !== 'aggressive') {
    throw new Error('Risk tolerance must be one of: conservative, moderate, aggressive.');
  }
  return { age, income, savings, goals, riskTolerance: riskToleranceRaw };
}

function buildUserPrompt(input: { readonly pbInput: PortfolioBuilderInput }): string {
  const { pbInput } = input;
  const goalsSection: string = pbInput.goals.length > 0 ? pbInput.goals : 'Not provided. Infer sensible goals from risk tolerance.';
  return `You are a senior portfolio strategist at Badgers Finance managing multi-asset portfolios worth $500M+ for institutional clients.

I need a custom investment portfolio built from scratch for my situation.

Create:

* Exact asset allocation with percentages across stocks, bonds, alternatives
* Specific ETF or fund recommendations for each category with ticker symbols
* Core holdings vs satellite positions clearly labeled
* Expected annual return range based on historical data
* Expected maximum drawdown in a bad year
* Rebalancing schedule and trigger rules
* Tax efficiency strategy for my account type
* Dollar cost averaging plan if I invest monthly
* Benchmark to measure my performance against
* One-page investment policy statement I can follow

Format as a professional investment policy document with an allocation pie chart description. Store as Markdown document.

My details:
- Age: ${pbInput.age}
- Annual income (USD): ${pbInput.income}
- Available savings (USD): ${pbInput.savings}
- Investment goals: ${goalsSection}
- Risk tolerance: ${pbInput.riskTolerance}
- Account type: Not provided
`;
}

export async function runPortfolioBuilderFlow(input: {
  readonly parameters: Record<string, unknown>;
  readonly credentials: LlmCredentials;
}): Promise<{ readonly markdownBody: string }> {
  const pbInput = parsePortfolioBuilderInput({ parameters: input.parameters });
  const userPrompt = buildUserPrompt({ pbInput });
  const markdownBody = await callAnalysisLlm({
    systemPrompt: PORTFOLIO_BUILDER_SYSTEM_PROMPT,
    userPrompt,
    credentials: input.credentials,
    emptyResponseError: 'AI response was empty for portfolio builder.',
  });
  return { markdownBody };
}

function parseRequiredNumber(input: { readonly value: unknown; readonly label: string }): number {
  if (typeof input.value !== 'number' || Number.isNaN(input.value) || !Number.isFinite(input.value)) {
    throw new Error(`${input.label} is required and must be a valid number.`);
  }
  return input.value;
}

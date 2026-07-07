import { requestAnthropicRecommendationJson } from '../../recommendations/anthropic-recommendation-llm-adapter.js';

export type LlmCredentials = {
  readonly apiKey: string;
  readonly modelId: string;
};

export async function callAnalysisLlm(input: {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly credentials: LlmCredentials;
  readonly emptyResponseError: string;
}): Promise<string> {
  const markdown: string = await requestAnthropicRecommendationJson({
    apiKey: input.credentials.apiKey,
    model: input.credentials.modelId,
    system: input.systemPrompt,
    user: input.userPrompt,
  });
  if (markdown.trim().length === 0) {
    throw new Error(input.emptyResponseError);
  }
  return markdown.trim();
}

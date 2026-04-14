/**
 * Normalizes common LLM formatting (markdown fences, preamble) before JSON.parse.
 */

/** First ```json ... ``` or ``` ... ``` block, if any; otherwise returns trimmed input. */
export function stripMarkdownJsonFence(text: string): string {
  const trimmed: string = text.trim();
  const match: RegExpMatchArray | null = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (match !== null && match[1] !== undefined) {
    return match[1].trim();
  }
  return trimmed;
}

/**
 * First top-level `{ ... }` substring with brace depth tracked outside of JSON strings.
 * Use when the model adds prose before/after the object.
 */
export function extractFirstBalancedJsonObject(text: string): string | undefined {
  const start: number = text.indexOf('{');
  if (start === -1) {
    return undefined;
  }
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch: string = text[i] ?? '';
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return undefined;
}

export function tryParseJsonFromLlmText(raw: string): { readonly ok: true; readonly value: unknown } | { readonly ok: false } {
  const trimmed: string = raw.trim();
  const stripped: string = stripMarkdownJsonFence(trimmed);
  const extTrimmed: string | undefined = extractFirstBalancedJsonObject(trimmed);
  const extStripped: string | undefined = extractFirstBalancedJsonObject(stripped);
  const candidates: string[] = [trimmed, stripped];
  if (extTrimmed !== undefined) {
    candidates.push(extTrimmed);
  }
  if (extStripped !== undefined && extStripped !== extTrimmed) {
    candidates.push(extStripped);
  }
  for (const c of candidates) {
    const t: string = c.trim();
    if (t.length === 0) {
      continue;
    }
    try {
      return { ok: true, value: JSON.parse(t) as unknown };
    } catch {
      // try next candidate
    }
  }
  return { ok: false };
}

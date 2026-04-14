import { describe, expect, it } from 'vitest';
import {
  extractFirstBalancedJsonObject,
  stripMarkdownJsonFence,
  tryParseJsonFromLlmText,
} from './coerce-llm-json-text.js';

describe('stripMarkdownJsonFence', () => {
  it('returns inner JSON for fenced json', () => {
    const inner = '{"a":1}';
    expect(stripMarkdownJsonFence(`  \`\`\`json\n${inner}\n\`\`\`  `)).toBe(inner);
  });

  it('returns inner JSON for fenced block without language tag', () => {
    expect(stripMarkdownJsonFence('```\n{"x":true}\n```')).toBe('{"x":true}');
  });

  it('leaves plain JSON unchanged aside from trim', () => {
    expect(stripMarkdownJsonFence('  {"b":2}  ')).toBe('{"b":2}');
  });
});

describe('extractFirstBalancedJsonObject', () => {
  it('pulls object after preamble', () => {
    const json = '{"items":[],"portfolio_summary":{"a":1}}';
    expect(extractFirstBalancedJsonObject(`Here you go:\n${json}\ntrailing`)).toBe(json);
  });

  it('ignores braces inside strings', () => {
    const json = '{"msg":"use {curly} here"}';
    expect(extractFirstBalancedJsonObject(`x ${json} y`)).toBe(json);
  });

  it('handles escaped quotes in strings', () => {
    const json = '{"msg":"say \\"hi\\""}';
    expect(extractFirstBalancedJsonObject(json)).toBe(json);
  });
});

describe('tryParseJsonFromLlmText', () => {
  it('parses fenced JSON with preamble', () => {
    const r = tryParseJsonFromLlmText('Okay.\n```json\n{"hello":"world"}\n```\n');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual({ hello: 'world' });
    }
  });

  it('parses object embedded in prose without fences', () => {
    const r = tryParseJsonFromLlmText('Output: {"z":3} thanks.');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual({ z: 3 });
    }
  });

  it('fails on non-JSON', () => {
    expect(tryParseJsonFromLlmText('no braces here').ok).toBe(false);
  });
});

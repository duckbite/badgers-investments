import { describe, expect, it } from 'vitest';
import { resolveTwrQueryBounds } from './resolve-twr-query-bounds.js';

describe('resolveTwrQueryBounds', () => {
  it('returns open bounds when no range or from/to', () => {
    const actual = resolveTwrQueryBounds({ range: undefined, from: undefined, to: undefined, todayYmd: '2026-04-13' });
    expect(actual).toEqual({ ok: true });
  });

  it('passes through explicit from/to', () => {
    const actual = resolveTwrQueryBounds({
      range: undefined,
      from: '2026-01-01',
      to: '2026-03-01',
      todayYmd: '2026-04-13',
    });
    expect(actual).toEqual({ ok: true, fromInclusive: '2026-01-01', toInclusive: '2026-03-01' });
  });

  it('rejects range combined with from', () => {
    const actual = resolveTwrQueryBounds({
      range: '1M',
      from: '2026-01-01',
      to: undefined,
      todayYmd: '2026-04-13',
    });
    expect(actual.ok).toBe(false);
    if (!actual.ok) {
      expect(actual.message).toMatch(/combine/i);
    }
  });

  it('computes YTD through today', () => {
    const actual = resolveTwrQueryBounds({ range: 'YTD', from: undefined, to: undefined, todayYmd: '2026-04-13' });
    expect(actual).toEqual({ ok: true, fromInclusive: '2026-01-01', toInclusive: '2026-04-13' });
  });

  it('computes 1M through today', () => {
    const actual = resolveTwrQueryBounds({ range: '1M', from: undefined, to: undefined, todayYmd: '2026-04-13' });
    expect(actual).toEqual({ ok: true, fromInclusive: '2026-03-13', toInclusive: '2026-04-13' });
  });

  it('ALL leaves bounds open', () => {
    const actual = resolveTwrQueryBounds({ range: 'ALL', from: undefined, to: undefined, todayYmd: '2026-04-13' });
    expect(actual).toEqual({ ok: true });
  });
});

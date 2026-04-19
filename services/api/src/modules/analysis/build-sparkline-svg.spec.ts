import { describe, expect, it } from 'vitest';
import { buildPriceSparklineSvg } from './build-sparkline-svg.js';

describe('buildPriceSparklineSvg', () => {
  it('returns a flat placeholder when fewer than two finite closes', () => {
    const svg = buildPriceSparklineSvg({ closes: [1], width: 120, height: 40 });
    expect(svg).toContain('viewBox="0 0 120 40"');
    expect(svg).not.toContain('<polyline');
  });

  it('includes a polyline when at least two closes are provided', () => {
    const svg = buildPriceSparklineSvg({
      closes: [10, 11, 9, 12],
      width: 100,
      height: 50,
    });
    expect(svg).toContain('<polyline');
    expect(svg).toContain('points="');
  });
});

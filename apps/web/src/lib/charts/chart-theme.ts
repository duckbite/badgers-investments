/**
 * Recharts-like Chart.js defaults aligned with `src/styles/theme.css` tokens.
 * Call `readChartThemePalette()` in the browser (e.g. `onMount`) so CSS variables resolve.
 */

export type ChartThemePalette = {
  readonly chartColors: readonly string[];
  readonly border: string;
  readonly mutedForeground: string;
  readonly foreground: string;
  readonly card: string;
  readonly popover: string;
  readonly primary: string;
  readonly destructive: string;
};

const FALLBACK: ChartThemePalette = {
  chartColors: ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'],
  border: 'rgba(0, 0, 0, 0.1)',
  mutedForeground: '#717182',
  foreground: 'oklch(0.145 0 0)',
  card: '#ffffff',
  popover: 'oklch(1 0 0)',
  primary: '#059669',
  destructive: '#d4183d',
};

function readCssVar(root: HTMLElement, name: string, fallback: string): string {
  const v: string = getComputedStyle(root).getPropertyValue(name).trim();
  return v.length > 0 ? v : fallback;
}

export function readChartThemePalette(): ChartThemePalette {
  if (typeof document === 'undefined') {
    return FALLBACK;
  }
  const root: HTMLElement = document.documentElement;
  const chartColors: readonly string[] = [
    readCssVar(root, '--chart-1', FALLBACK.chartColors[0] ?? '#059669'),
    readCssVar(root, '--chart-2', FALLBACK.chartColors[1] ?? '#10b981'),
    readCssVar(root, '--chart-3', FALLBACK.chartColors[2] ?? '#34d399'),
    readCssVar(root, '--chart-4', FALLBACK.chartColors[3] ?? '#6ee7b7'),
    readCssVar(root, '--chart-5', FALLBACK.chartColors[4] ?? '#a7f3d0'),
  ];
  return {
    chartColors,
    border: readCssVar(root, '--border', FALLBACK.border),
    mutedForeground: readCssVar(root, '--muted-foreground', FALLBACK.mutedForeground),
    foreground: readCssVar(root, '--foreground', FALLBACK.foreground),
    card: readCssVar(root, '--card', FALLBACK.card),
    popover: readCssVar(root, '--popover', FALLBACK.popover),
    primary: readCssVar(root, '--primary', FALLBACK.primary),
    destructive: readCssVar(root, '--destructive', FALLBACK.destructive),
  };
}

/** Parse `#rrggbb` or `rgb()` — returns `rgba(r,g,b,a)` for Chart.js. */
export function colorWithAlpha(input: string, alpha: number): string {
  const hex: RegExpMatchArray | null = /^#([0-9a-f]{6})$/i.exec(input.trim());
  if (hex !== null) {
    const n: number = Number.parseInt(hex[1] ?? '0', 16);
    const r: number = (n >> 16) & 255;
    const g: number = (n >> 8) & 255;
    const b: number = n & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return input;
}

export function buildChartJsTooltipTheme(input: ChartThemePalette): Record<string, unknown> {
  return {
    backgroundColor: input.card,
    titleColor: input.foreground,
    bodyColor: input.mutedForeground,
    borderColor: input.border,
    borderWidth: 1,
    padding: 12,
    cornerRadius: 8,
    displayColors: true,
    boxPadding: 4,
  };
}

export function buildCartesianGridStyle(input: ChartThemePalette): { readonly color: string } {
  return { color: colorWithAlpha(input.border, 0.6) };
}

export function buildTickStyle(input: ChartThemePalette): { readonly color: string; readonly maxRotation?: number } {
  return { color: input.mutedForeground, maxRotation: 0 };
}

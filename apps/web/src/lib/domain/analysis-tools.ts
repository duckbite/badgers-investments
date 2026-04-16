import type { AnalysisType } from '$lib/api/analysis';

export type AnalysisToolDefinition = {
  readonly id: AnalysisType;
  readonly title: string;
  readonly description: string;
  readonly icon: 'search' | 'calculator' | 'alert' | 'trending' | 'line' | 'briefcase' | 'bar' | 'globe';
  readonly colorClassName: string;
  readonly cta: string;
  readonly isAvailable: boolean;
};

export const ANALYSIS_TOOL_DEFINITIONS: readonly AnalysisToolDefinition[] = [
  {
    id: 'technical-analysis',
    title: 'Technical Analysis',
    description: 'Chart patterns and technical indicators',
    icon: 'line',
    colorClassName: 'bg-indigo-100 text-indigo-600',
    cta: 'Run Analysis',
    isAvailable: true,
  },
  {
    id: 'portfolio-builder',
    title: 'Portfolio Builder',
    description: 'Custom portfolio from scratch based on your goals',
    icon: 'briefcase',
    colorClassName: 'bg-emerald-100 text-emerald-600',
    cta: 'Build Portfolio',
    isAvailable: true,
  },
  {
    id: 'stock-screener',
    title: 'Stock Screener',
    description: 'Find the best stocks based on your criteria',
    icon: 'search',
    colorClassName: 'bg-blue-100 text-blue-600',
    cta: 'Start Analysis',
    isAvailable: false,
  },
  {
    id: 'dcf-valuation',
    title: 'DCF Valuation',
    description: '5-year revenue projection with growth assumptions',
    icon: 'calculator',
    colorClassName: 'bg-green-100 text-green-600',
    cta: 'Start Analysis',
    isAvailable: false,
  },
  {
    id: 'risk-assessment',
    title: 'Risk Assessment',
    description: 'Professional risk report with heat map summary',
    icon: 'alert',
    colorClassName: 'bg-orange-100 text-orange-600',
    cta: 'Start Analysis',
    isAvailable: false,
  },
  {
    id: 'earnings-analysis',
    title: 'Earnings Analysis',
    description: 'Deep dive into company earnings performance',
    icon: 'trending',
    colorClassName: 'bg-purple-100 text-purple-600',
    cta: 'Start Analysis',
    isAvailable: false,
  },
  {
    id: 'competitive-analysis',
    title: 'Competitive Analysis',
    description: 'Compare companies within a sector',
    icon: 'bar',
    colorClassName: 'bg-cyan-100 text-cyan-600',
    cta: 'Start Analysis',
    isAvailable: false,
  },
  {
    id: 'macro-impact',
    title: 'Macro Impact Report',
    description: 'How economic conditions affect your portfolio',
    icon: 'globe',
    colorClassName: 'bg-pink-100 text-pink-600',
    cta: 'Start Analysis',
    isAvailable: false,
  },
];

export function formatAnalysisType(type: AnalysisType): string {
  return type
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

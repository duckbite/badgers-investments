export interface AnalysisRequest {
  id: string;
  type: 'stock-screener' | 'dcf-valuation' | 'risk-assessment' | 'earnings-analysis' |
        'technical-analysis' | 'portfolio-builder' | 'competitive-analysis' | 'macro-impact';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  parameters: Record<string, any>;
  result?: any;
  reportId?: string;
}

export interface Report {
  id: string;
  title: string;
  type: string;
  createdBy: string;
  createdAt: string;
  summary: string;
  content: any;
}

// Mock data for completed analyses
export const mockAnalyses: AnalysisRequest[] = [
  {
    id: 'a1',
    type: 'stock-screener',
    status: 'completed',
    createdAt: '2026-04-10T10:30:00',
    completedAt: '2026-04-10T10:32:15',
    parameters: {
      riskTolerance: 'moderate',
      investmentAmount: 50000,
      timeHorizon: '5-10 years',
      sectors: ['Technology', 'Healthcare']
    },
    reportId: 'r1'
  },
  {
    id: 'a2',
    type: 'risk-assessment',
    status: 'completed',
    createdAt: '2026-04-09T14:20:00',
    completedAt: '2026-04-09T14:25:30',
    parameters: {},
    reportId: 'r2'
  },
  {
    id: 'a3',
    type: 'dcf-valuation',
    status: 'processing',
    createdAt: '2026-04-12T09:15:00',
    parameters: {
      symbol: 'MSFT',
      companyName: 'Microsoft Corporation'
    }
  }
];

export const mockReports: Report[] = [
  {
    id: 'r1',
    title: 'Technology & Healthcare Stock Screening Report',
    type: 'stock-screener',
    createdBy: 'You',
    createdAt: '2026-04-10T10:32:15',
    summary: 'Top 10 stocks matching moderate risk profile with $50K investment in Tech and Healthcare sectors',
    content: {
      stocks: ['AAPL', 'MSFT', 'JNJ', 'UNH', 'GOOGL', 'NVDA', 'PFE', 'ABBV', 'TMO', 'ABT']
    }
  },
  {
    id: 'r2',
    title: 'Portfolio Risk Assessment Report',
    type: 'risk-assessment',
    createdBy: 'You',
    createdAt: '2026-04-09T14:25:30',
    summary: 'Comprehensive risk analysis of current portfolio holdings with heat map visualization',
    content: {
      overallRisk: 'Medium',
      diversificationScore: 7.5
    }
  },
  {
    id: 'r3',
    title: 'Q4 2025 Earnings Analysis: Tesla Inc',
    type: 'earnings-analysis',
    createdBy: 'John Smith',
    createdAt: '2026-04-08T16:45:00',
    summary: 'Detailed earnings analysis for TSLA with revenue growth and margin trends',
    content: {}
  },
  {
    id: 'r4',
    title: 'EV Sector Competitive Landscape',
    type: 'competitive-analysis',
    createdBy: 'Sarah Johnson',
    createdAt: '2026-04-07T11:20:00',
    summary: 'Competitive analysis of leading EV manufacturers with investment recommendations',
    content: {}
  }
];

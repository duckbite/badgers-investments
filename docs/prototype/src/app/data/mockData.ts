export interface Asset {
  id: string;
  name: string;
  symbol: string;
  assetClass: 'stocks' | 'bonds' | 'real-estate' | 'crypto' | 'commodities' | 'cash';
  quantity: number;
  currentPrice: number;
  costBasis: number;
  currency: string;
  exchange?: string;
  broker?: string;
  sector?: string;
}

export interface Transaction {
  id: string;
  date: string;
  type: 'buy' | 'sell' | 'dividend' | 'deposit' | 'withdrawal';
  assetId?: string;
  assetName?: string;
  assetClass?: 'stocks' | 'bonds' | 'real-estate' | 'crypto' | 'commodities' | 'cash';
  quantity?: number;
  price?: number;
  amount: number;
  currency: string;
  notes?: string;
  exchange?: string;
  broker?: string;
}

export interface PerformanceData {
  date: string;
  portfolioValue: number;
  deposits: number;
  withdrawals: number;
  twr: number;
}

export interface Recommendation {
  id: string;
  type: 'rebalance' | 'buy' | 'sell' | 'alert';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  generatedBy: 'rule' | 'ai';
  createdAt: string;
  assetClass?: string;
  suggestedAction?: string;
}

export const mockAssets: Asset[] = [
  {
    id: '1',
    name: 'Apple Inc.',
    symbol: 'AAPL',
    assetClass: 'stocks',
    quantity: 50,
    currentPrice: 178.50,
    costBasis: 165.00,
    currency: 'USD',
    exchange: 'NASDAQ',
    broker: 'Fidelity',
    sector: 'Technology',
  },
  {
    id: '2',
    name: 'Microsoft Corporation',
    symbol: 'MSFT',
    assetClass: 'stocks',
    quantity: 40,
    currentPrice: 415.20,
    costBasis: 380.00,
    currency: 'USD',
    exchange: 'NASDAQ',
    broker: 'Charles Schwab',
    sector: 'Technology',
  },
  {
    id: '3',
    name: 'Vanguard Total Bond Market',
    symbol: 'BND',
    assetClass: 'bonds',
    quantity: 200,
    currentPrice: 74.30,
    costBasis: 76.50,
    currency: 'USD',
    exchange: 'NYSE',
    broker: 'Charles Schwab',
  },
  {
    id: '4',
    name: 'Vanguard Real Estate ETF',
    symbol: 'VNQ',
    assetClass: 'real-estate',
    quantity: 75,
    currentPrice: 89.45,
    costBasis: 85.00,
    currency: 'USD',
    exchange: 'NYSE',
    broker: 'Fidelity',
  },
  {
    id: '5',
    name: 'Bitcoin',
    symbol: 'BTC',
    assetClass: 'crypto',
    quantity: 0.5,
    currentPrice: 52000.00,
    costBasis: 48000.00,
    currency: 'USD',
    exchange: 'Coinbase',
    broker: 'Coinbase',
  },
  {
    id: '6',
    name: 'Gold ETF',
    symbol: 'GLD',
    assetClass: 'commodities',
    quantity: 30,
    currentPrice: 195.80,
    costBasis: 188.00,
    currency: 'USD',
    exchange: 'NYSE',
    broker: 'Fidelity',
  },
  {
    id: '7',
    name: 'Cash Reserve',
    symbol: 'CASH',
    assetClass: 'cash',
    quantity: 1,
    currentPrice: 15000.00,
    costBasis: 15000.00,
    currency: 'USD',
    exchange: 'N/A',
    broker: 'N/A',
  },
];

export const mockTransactions: Transaction[] = [
  {
    id: 't1',
    date: '2026-02-20',
    type: 'buy',
    assetId: '1',
    assetName: 'Apple Inc.',
    assetClass: 'stocks',
    quantity: 10,
    price: 178.50,
    amount: 1785.00,
    currency: 'USD',
    exchange: 'NASDAQ',
    broker: 'Fidelity',
  },
  {
    id: 't2',
    date: '2026-02-18',
    type: 'dividend',
    assetId: '2',
    assetName: 'Microsoft Corporation',
    assetClass: 'stocks',
    amount: 120.00,
    currency: 'USD',
    notes: 'Quarterly dividend',
  },
  {
    id: 't3',
    date: '2026-02-15',
    type: 'sell',
    assetId: '3',
    assetName: 'Vanguard Total Bond Market',
    assetClass: 'bonds',
    quantity: 50,
    price: 74.30,
    amount: 3715.00,
    currency: 'USD',
    exchange: 'NYSE',
    broker: 'Charles Schwab',
  },
  {
    id: 't4',
    date: '2026-02-10',
    type: 'deposit',
    amount: 5000.00,
    currency: 'USD',
    notes: 'Monthly contribution',
  },
  {
    id: 't5',
    date: '2026-02-05',
    type: 'buy',
    assetId: '5',
    assetName: 'Bitcoin',
    assetClass: 'crypto',
    quantity: 0.1,
    price: 52000.00,
    amount: 5200.00,
    currency: 'USD',
    exchange: 'Coinbase',
    broker: 'Coinbase',
  },
  {
    id: 't6',
    date: '2026-01-30',
    type: 'buy',
    assetId: '4',
    assetName: 'Vanguard Real Estate ETF',
    assetClass: 'real-estate',
    quantity: 25,
    price: 89.45,
    amount: 2236.25,
    currency: 'USD',
    exchange: 'NYSE',
    broker: 'Fidelity',
  },
  {
    id: 't7',
    date: '2026-01-25',
    type: 'dividend',
    assetId: '1',
    assetName: 'Apple Inc.',
    assetClass: 'stocks',
    amount: 45.00,
    currency: 'USD',
    notes: 'Quarterly dividend',
  },
  {
    id: 't8',
    date: '2026-01-20',
    type: 'buy',
    assetId: '2',
    assetName: 'Microsoft Corporation',
    assetClass: 'stocks',
    quantity: 5,
    price: 415.20,
    amount: 2076.00,
    currency: 'USD',
    exchange: 'NASDAQ',
    broker: 'Charles Schwab',
  },
];

export const mockPerformanceData: PerformanceData[] = [
  { date: '2025-08', portfolioValue: 68000, deposits: 5000, withdrawals: 0, twr: 0 },
  { date: '2025-09', portfolioValue: 70500, deposits: 5000, withdrawals: 0, twr: 1.8 },
  { date: '2025-10', portfolioValue: 73200, deposits: 5000, withdrawals: 0, twr: 2.1 },
  { date: '2025-11', portfolioValue: 71800, deposits: 5000, withdrawals: 0, twr: -0.5 },
  { date: '2025-12', portfolioValue: 75600, deposits: 5000, withdrawals: 0, twr: 3.2 },
  { date: '2026-01', portfolioValue: 79300, deposits: 5000, withdrawals: 0, twr: 3.5 },
  { date: '2026-02', portfolioValue: 82145, deposits: 5000, withdrawals: 0, twr: 2.8 },
];

export const mockRecommendations: Recommendation[] = [
  {
    id: 'r1',
    type: 'rebalance',
    priority: 'high',
    title: 'Portfolio Rebalancing Needed',
    description: 'Your stock allocation has increased to 67% of your portfolio, exceeding your target of 60%. Consider rebalancing to maintain your risk profile.',
    generatedBy: 'rule',
    createdAt: '2026-02-24',
    assetClass: 'stocks',
    suggestedAction: 'Sell $5,000 in stocks and move to bonds',
  },
  {
    id: 'r2',
    type: 'buy',
    priority: 'medium',
    title: 'Underweight in Real Estate',
    description: 'Based on AI analysis of current market conditions and your portfolio composition, increasing real estate exposure could improve diversification.',
    generatedBy: 'ai',
    createdAt: '2026-02-23',
    assetClass: 'real-estate',
    suggestedAction: 'Consider adding $3,000 to VNQ',
  },
  {
    id: 'r3',
    type: 'alert',
    priority: 'high',
    title: 'High Volatility Detected',
    description: 'Your cryptocurrency holdings have experienced 15% volatility in the past week. This exceeds your risk tolerance settings.',
    generatedBy: 'rule',
    createdAt: '2026-02-22',
    assetClass: 'crypto',
  },
  {
    id: 'r4',
    type: 'sell',
    priority: 'low',
    title: 'Bond Underperformance',
    description: 'AI analysis suggests that BND has underperformed its benchmark by 2% over the past quarter. Consider alternatives.',
    generatedBy: 'ai',
    createdAt: '2026-02-21',
    assetClass: 'bonds',
    suggestedAction: 'Research alternative bond ETFs',
  },
  {
    id: 'r5',
    type: 'buy',
    priority: 'medium',
    title: 'Tax-Loss Harvesting Opportunity',
    description: 'Your bond position is down 2.9%. This presents a tax-loss harvesting opportunity while maintaining similar exposure.',
    generatedBy: 'rule',
    createdAt: '2026-02-20',
    assetClass: 'bonds',
  },
];
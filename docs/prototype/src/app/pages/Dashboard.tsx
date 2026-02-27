import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { mockAssets, mockTransactions, mockRecommendations, type Asset } from "../data/mockData";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, AlertCircle } from "lucide-react";
import { Badge } from "../components/ui/badge";

export default function Dashboard() {
  // Calculate portfolio metrics
  const totalValue = mockAssets.reduce((sum, asset) => sum + (asset.quantity * asset.currentPrice), 0);
  const totalCost = mockAssets.reduce((sum, asset) => sum + (asset.quantity * asset.costBasis), 0);
  const totalGainLoss = totalValue - totalCost;
  const totalGainLossPercent = ((totalGainLoss / totalCost) * 100);

  // Asset allocation by class
  const assetAllocation = mockAssets.reduce((acc, asset) => {
    const value = asset.quantity * asset.currentPrice;
    const existing = acc.find(item => item.name === asset.assetClass);
    if (existing) {
      existing.value += value;
    } else {
      acc.push({
        name: asset.assetClass.charAt(0).toUpperCase() + asset.assetClass.slice(1),
        value: value,
      });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  // Stock allocation by sector
  const stocksBySector = mockAssets
    .filter(asset => asset.assetClass === 'stocks')
    .reduce((acc, asset) => {
      const value = asset.quantity * asset.currentPrice;
      const sector = asset.sector || 'Other';
      const existing = acc.find(item => item.name === sector);
      if (existing) {
        existing.value += value;
      } else {
        acc.push({
          name: sector,
          value: value,
        });
      }
      return acc;
    }, [] as { name: string; value: number }[]);

  const COLORS = ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#3b82f6', '#8b5cf6'];

  // Recent transactions
  const recentTransactions = mockTransactions.slice(0, 5);

  // High priority recommendations
  const highPriorityRecs = mockRecommendations.filter(rec => rec.priority === 'high');

  // Performance data for mini chart
  const performanceData = [
    { month: 'Aug', value: 68000 },
    { month: 'Sep', value: 70500 },
    { month: 'Oct', value: 73200 },
    { month: 'Nov', value: 71800 },
    { month: 'Dec', value: 75600 },
    { month: 'Jan', value: 79300 },
    { month: 'Feb', value: 82145 },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Portfolio Overview</h2>
        <p className="text-gray-600 mt-1">Monitor your investments and track performance</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Portfolio Value</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">
                ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              {totalGainLoss >= 0 ? (
                <TrendingUp className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
              <span className={`text-sm font-medium ${totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${Math.abs(totalGainLoss).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({totalGainLossPercent.toFixed(2)}%)
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Cost Basis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">
                ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <DollarSign className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">
                Initial investment
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">{highPriorityRecs.length}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <AlertCircle className="w-4 h-4 text-orange-600" />
              <span className="text-sm text-gray-600">
                High priority recommendations
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asset Allocation */}
        <Card>
          <CardHeader>
            <CardTitle>Asset Allocation</CardTitle>
            <CardDescription>Distribution across asset classes</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={assetAllocation}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {assetAllocation.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Stocks by Sector */}
        <Card>
          <CardHeader>
            <CardTitle>Stocks by Sector</CardTitle>
            <CardDescription>Stock holdings by sector</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stocksBySector}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {stocksBySector.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Second Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Growth</CardTitle>
            <CardDescription>6-month performance trend</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: number) => `$${value.toLocaleString('en-US')}`} />
                <Line type="monotone" dataKey="value" stroke="#059669" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity and Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Latest ledger entries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTransactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        transaction.type === 'buy' ? 'default' :
                        transaction.type === 'sell' ? 'secondary' :
                        transaction.type === 'dividend' ? 'outline' :
                        'default'
                      }>
                        {transaction.type}
                      </Badge>
                      <span className="font-medium text-gray-900">{transaction.assetName || 'Cash'}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{transaction.date}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${
                      transaction.type === 'buy' || transaction.type === 'withdrawal' ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {transaction.type === 'buy' || transaction.type === 'withdrawal' ? '-' : '+'}
                      ${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    {transaction.quantity && (
                      <p className="text-sm text-gray-500">{transaction.quantity} @ ${transaction.price?.toFixed(2)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* High Priority Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle>Priority Recommendations</CardTitle>
            <CardDescription>Action items requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {highPriorityRecs.map((rec) => (
                <div key={rec.id} className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-orange-600" />
                        <h4 className="font-medium text-gray-900">{rec.title}</h4>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">{rec.description}</p>
                      {rec.suggestedAction && (
                        <p className="text-sm font-medium text-orange-700 mt-2">{rec.suggestedAction}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {rec.generatedBy}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
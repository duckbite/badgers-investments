import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { mockPerformanceData } from "../data/mockData";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, Calendar, Percent, DollarSign } from "lucide-react";

export default function Performance() {
  // Calculate key metrics
  const latestData = mockPerformanceData[mockPerformanceData.length - 1];
  const earliestData = mockPerformanceData[0];
  
  const totalReturn = latestData.portfolioValue - earliestData.portfolioValue;
  const totalDeposits = mockPerformanceData.reduce((sum, d) => sum + d.deposits, 0);
  const totalWithdrawals = mockPerformanceData.reduce((sum, d) => sum + d.withdrawals, 0);
  
  const avgTWR = mockPerformanceData.reduce((sum, d) => sum + d.twr, 0) / mockPerformanceData.length;
  const currentTWR = latestData.twr;

  // Format data for charts
  const portfolioValueData = mockPerformanceData.map(d => ({
    month: d.date,
    value: d.portfolioValue,
    deposits: d.deposits,
  }));

  const twrData = mockPerformanceData.map(d => ({
    month: d.date,
    twr: d.twr,
  }));

  const cashFlowData = mockPerformanceData.map(d => ({
    month: d.date,
    deposits: d.deposits,
    withdrawals: d.withdrawals,
  }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Performance Analytics</h2>
        <p className="text-gray-600 mt-1">Time-weighted returns and portfolio performance metrics</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Percent className="w-4 h-4" />
              Current TWR
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">{currentTWR.toFixed(2)}%</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">This period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Average TWR
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">{avgTWR.toFixed(2)}%</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">6-month average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Total Return
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-green-600">
                ${totalReturn.toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-2">Portfolio growth</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Net Contributions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">
                ${(totalDeposits - totalWithdrawals).toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-2">Total deposits minus withdrawals</p>
          </CardContent>
        </Card>
      </div>

      {/* Portfolio Value Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Value Over Time</CardTitle>
          <CardDescription>Historical portfolio value with contribution markers</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={portfolioValueData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  `$${value.toLocaleString('en-US')}`,
                  name === 'value' ? 'Portfolio Value' : 'Deposits'
                ]}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#059669" 
                fillOpacity={1} 
                fill="url(#colorValue)"
                name="Portfolio Value"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* TWR Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Time-Weighted Return (TWR)</CardTitle>
          <CardDescription>Monthly performance excluding cash flow impact</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={twrData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => [`${value.toFixed(2)}%`, 'TWR']}
              />
              <Bar 
                dataKey="twr" 
                fill="#059669"
                name="TWR %"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cash Flow Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Cash Flow Analysis</CardTitle>
          <CardDescription>Deposits and withdrawals over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={cashFlowData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => [`$${value.toLocaleString('en-US')}`, '']}
              />
              <Legend />
              <Bar dataKey="deposits" fill="#10b981" name="Deposits" />
              <Bar dataKey="withdrawals" fill="#ef4444" name="Withdrawals" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Performance Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Period-by-Period Performance</CardTitle>
          <CardDescription>Detailed monthly breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockPerformanceData.map((period, index) => {
              const prevValue = index > 0 ? mockPerformanceData[index - 1].portfolioValue : period.portfolioValue;
              const valueChange = period.portfolioValue - prevValue;
              
              return (
                <div key={period.date} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-20 font-medium text-gray-900">{period.date}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">TWR:</span>
                      <span className={`font-medium ${period.twr >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {period.twr >= 0 ? '+' : ''}{period.twr.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Value</p>
                      <p className="font-medium text-gray-900">
                        ${period.portfolioValue.toLocaleString('en-US')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Change</p>
                      <p className={`font-medium ${valueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {valueChange >= 0 ? '+' : ''}${valueChange.toLocaleString('en-US')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Deposits</p>
                      <p className="font-medium text-gray-900">
                        ${period.deposits.toLocaleString('en-US')}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
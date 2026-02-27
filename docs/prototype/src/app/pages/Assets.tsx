import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { mockAssets, type Asset } from "../data/mockData";
import { Badge } from "../components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";

export default function Assets() {
  // Group assets by class
  const assetsByClass = mockAssets.reduce((acc, asset) => {
    if (!acc[asset.assetClass]) {
      acc[asset.assetClass] = [];
    }
    acc[asset.assetClass].push(asset);
    return acc;
  }, {} as Record<string, Asset[]>);

  const calculateMetrics = (asset: Asset) => {
    const currentValue = asset.quantity * asset.currentPrice;
    const costBasisTotal = asset.quantity * asset.costBasis;
    const gainLoss = currentValue - costBasisTotal;
    const gainLossPercent = ((gainLoss / costBasisTotal) * 100);
    return { currentValue, costBasisTotal, gainLoss, gainLossPercent };
  };

  const assetClassLabels: Record<string, string> = {
    stocks: 'Stocks',
    bonds: 'Bonds',
    'real-estate': 'Real Estate',
    crypto: 'Cryptocurrency',
    commodities: 'Commodities',
    cash: 'Cash & Equivalents',
  };

  const totalPortfolioValue = mockAssets.reduce((sum, asset) => {
    return sum + (asset.quantity * asset.currentPrice);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Asset Holdings</h2>
        <p className="text-gray-600 mt-1">Detailed view of all positions across asset classes</p>
      </div>

      {/* Assets by Class */}
      {Object.entries(assetsByClass).map(([assetClass, assets]) => {
        const classTotal = assets.reduce((sum, asset) => sum + (asset.quantity * asset.currentPrice), 0);
        const classCost = assets.reduce((sum, asset) => sum + (asset.quantity * asset.costBasis), 0);
        const classGainLoss = classTotal - classCost;
        const allocationPercent = (classTotal / totalPortfolioValue * 100);

        return (
          <Card key={assetClass}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{assetClassLabels[assetClass]}</CardTitle>
                  <CardDescription className="mt-1">
                    {assets.length} position{assets.length !== 1 ? 's' : ''} • {allocationPercent.toFixed(1)}% of portfolio
                  </CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">
                    ${classTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    {classGainLoss >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    )}
                    <span className={`text-sm font-medium ${classGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${Math.abs(classGainLoss).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Cost Basis</TableHead>
                    <TableHead className="text-right">Current Value</TableHead>
                    <TableHead className="text-right">Gain/Loss</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((asset) => {
                    const metrics = calculateMetrics(asset);
                    return (
                      <TableRow key={asset.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-gray-900">{asset.name}</p>
                            <p className="text-sm text-gray-500">{asset.symbol}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {asset.quantity.toLocaleString('en-US', { 
                            minimumFractionDigits: asset.quantity < 1 ? 4 : 0,
                            maximumFractionDigits: asset.quantity < 1 ? 4 : 0,
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          ${asset.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right">
                          ${metrics.costBasisTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${metrics.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className={`font-medium ${metrics.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {metrics.gainLoss >= 0 ? '+' : ''}${metrics.gainLoss.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                            <Badge variant={metrics.gainLoss >= 0 ? 'default' : 'secondary'} className="ml-2">
                              {metrics.gainLossPercent >= 0 ? '+' : ''}{metrics.gainLossPercent.toFixed(2)}%
                            </Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

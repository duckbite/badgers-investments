import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { mockTransactions, type Transaction } from "../data/mockData";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { ArrowUpRight, ArrowDownLeft, DollarSign, TrendingUp, Plus, Pencil, Trash2, Filter } from "lucide-react";
import { TransactionDialog } from "../components/TransactionDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useAnonymize } from "../contexts/AnonymizeContext";

export default function Ledger() {
  const { formatAmount } = useAnonymize();
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);
  const [assetFilter, setAssetFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [assetClassFilter, setAssetClassFilter] = useState<string>("all");

  // Filter transactions
  const filteredTransactions = transactions.filter(transaction => {
    const matchesAsset = assetFilter === "all" || transaction.assetName?.toLowerCase().includes(assetFilter.toLowerCase());
    const matchesType = typeFilter === "all" || transaction.type === typeFilter;
    const matchesClass = assetClassFilter === "all" || transaction.assetClass === assetClassFilter;
    return matchesAsset && matchesType && matchesClass;
  });

  // Sort transactions by date (most recent first)
  const sortedTransactions = [...filteredTransactions].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Calculate summary metrics
  const totalDeposits = transactions
    .filter(t => t.type === 'deposit')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalWithdrawals = transactions
    .filter(t => t.type === 'withdrawal')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalDividends = transactions
    .filter(t => t.type === 'dividend')
    .reduce((sum, t) => sum + t.amount, 0);

  const handleCreateTransaction = (transaction: Omit<Transaction, 'id'>) => {
    const newTransaction: Transaction = {
      ...transaction,
      id: `t${Date.now()}`,
    };
    setTransactions([...transactions, newTransaction]);
    setIsDialogOpen(false);
  };

  const handleUpdateTransaction = (transaction: Transaction) => {
    setTransactions(transactions.map(t => t.id === transaction.id ? transaction : t));
    setIsDialogOpen(false);
    setEditingTransaction(undefined);
  };

  const handleDeleteTransaction = (id: string) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      setTransactions(transactions.filter(t => t.id !== id));
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingTransaction(undefined);
  };

  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'buy':
        return <ArrowDownLeft className="w-4 h-4 text-red-600" />;
      case 'sell':
        return <ArrowUpRight className="w-4 h-4 text-green-600" />;
      case 'dividend':
        return <TrendingUp className="w-4 h-4 text-blue-600" />;
      case 'deposit':
        return <ArrowUpRight className="w-4 h-4 text-green-600" />;
      case 'withdrawal':
        return <ArrowDownLeft className="w-4 h-4 text-red-600" />;
    }
  };

  const getBadgeVariant = (type: Transaction['type']) => {
    switch (type) {
      case 'buy':
        return 'destructive' as const;
      case 'sell':
        return 'default' as const;
      case 'dividend':
        return 'outline' as const;
      case 'deposit':
        return 'default' as const;
      case 'withdrawal':
        return 'secondary' as const;
    }
  };

  // Get unique asset names for filter
  const uniqueAssets = Array.from(new Set(transactions.map(t => t.assetName).filter(Boolean)));

  // Get unique asset classes for filter
  const uniqueAssetClasses = Array.from(new Set(transactions.map(t => t.assetClass).filter(Boolean)));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Transaction Ledger</h2>
          <p className="text-gray-600 mt-1">Complete history of all portfolio transactions</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Transaction
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Deposits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-2xl font-bold text-gray-900">
                ${formatAmount(totalDeposits)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Withdrawals</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <ArrowDownLeft className="w-5 h-5 text-red-600" />
              </div>
              <span className="text-2xl font-bold text-gray-900">
                ${formatAmount(totalWithdrawals)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Dividends</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-2xl font-bold text-gray-900">
                ${formatAmount(totalDividends)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Transactions</CardTitle>
              <CardDescription>Ledger-based transaction history</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="buy">Buy</SelectItem>
                    <SelectItem value="sell">Sell</SelectItem>
                    <SelectItem value="dividend">Dividend</SelectItem>
                    <SelectItem value="deposit">Deposit</SelectItem>
                    <SelectItem value="withdrawal">Withdrawal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Select value={assetFilter} onValueChange={setAssetFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by asset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assets</SelectItem>
                  {uniqueAssets.map(asset => (
                    <SelectItem key={asset} value={asset!}>{asset}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={assetClassFilter} onValueChange={setAssetClassFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by asset class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Asset Classes</SelectItem>
                  {uniqueAssetClasses.map(assetClass => (
                    <SelectItem key={assetClass} value={assetClass!}>{assetClass}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sortedTransactions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>Asset Class</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Broker</TableHead>
                  <TableHead>Exchange</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTransactionIcon(transaction.type)}
                        <span className="text-sm font-medium">
                          {new Date(transaction.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getBadgeVariant(transaction.type)}>
                        {transaction.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {transaction.assetName ? (
                        <div>
                          <p className="font-medium text-gray-900">{transaction.assetName}</p>
                        </div>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {transaction.assetClass ? (
                        <Badge variant="outline" className="capitalize">
                          {transaction.assetClass.replace('-', ' ')}
                        </Badge>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {transaction.quantity ? (
                        <span className="font-medium">
                          {transaction.quantity.toLocaleString('en-US', {
                            minimumFractionDigits: transaction.quantity < 1 ? 4 : 0,
                            maximumFractionDigits: transaction.quantity < 1 ? 4 : 2,
                          })}
                        </span>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {transaction.price ? (
                        <span>${formatAmount(transaction.price)}</span>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-medium ${
                        transaction.type === 'buy' || transaction.type === 'withdrawal'
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}>
                        {transaction.type === 'buy' || transaction.type === 'withdrawal' ? '-' : '+'}
                        ${formatAmount(transaction.amount)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {transaction.broker ? (
                        <span className="text-sm text-gray-700">{transaction.broker}</span>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {transaction.exchange ? (
                        <span className="text-sm text-gray-700">{transaction.exchange}</span>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-500">{transaction.notes || '—'}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(transaction)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTransaction(transaction.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">No transactions match the selected filters.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setAssetFilter("all");
                  setTypeFilter("all");
                  setAssetClassFilter("all");
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionDialog
        open={isDialogOpen}
        onClose={handleDialogClose}
        onSave={editingTransaction ? handleUpdateTransaction : handleCreateTransaction}
        transaction={editingTransaction}
      />
    </div>
  );
}
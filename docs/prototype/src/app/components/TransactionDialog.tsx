import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { type Transaction } from "../data/mockData";

interface TransactionDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (transaction: Transaction | Omit<Transaction, 'id'>) => void;
  transaction?: Transaction;
}

export function TransactionDialog({ open, onClose, onSave, transaction }: TransactionDialogProps) {
  const [formData, setFormData] = useState({
    date: '',
    type: 'buy' as Transaction['type'],
    assetId: '',
    assetName: '',
    assetClass: '' as Transaction['assetClass'],
    quantity: '',
    price: '',
    amount: '',
    currency: 'USD',
    notes: '',
    exchange: '',
    broker: '',
  });

  useEffect(() => {
    if (transaction) {
      setFormData({
        date: transaction.date,
        type: transaction.type,
        assetId: transaction.assetId || '',
        assetName: transaction.assetName || '',
        assetClass: transaction.assetClass || '',
        quantity: transaction.quantity?.toString() || '',
        price: transaction.price?.toString() || '',
        amount: transaction.amount.toString(),
        currency: transaction.currency,
        notes: transaction.notes || '',
        exchange: transaction.exchange || '',
        broker: transaction.broker || '',
      });
    } else {
      // Reset to defaults
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        date: today,
        type: 'buy',
        assetId: '',
        assetName: '',
        assetClass: '',
        quantity: '',
        price: '',
        amount: '',
        currency: 'USD',
        notes: '',
        exchange: '',
        broker: '',
      });
    }
  }, [transaction, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const transactionData = {
      date: formData.date,
      type: formData.type,
      assetId: formData.assetId || undefined,
      assetName: formData.assetName || undefined,
      assetClass: formData.assetClass || undefined,
      quantity: formData.quantity ? parseFloat(formData.quantity) : undefined,
      price: formData.price ? parseFloat(formData.price) : undefined,
      amount: parseFloat(formData.amount),
      currency: formData.currency,
      notes: formData.notes || undefined,
      exchange: formData.exchange || undefined,
      broker: formData.broker || undefined,
    };

    if (transaction) {
      onSave({ ...transactionData, id: transaction.id });
    } else {
      onSave(transactionData);
    }
  };

  const needsAssetDetails = formData.type === 'buy' || formData.type === 'sell' || formData.type === 'dividend';

  // Auto-calculate amount when quantity and price are provided
  useEffect(() => {
    if (formData.quantity && formData.price && (formData.type === 'buy' || formData.type === 'sell')) {
      const calculatedAmount = parseFloat(formData.quantity) * parseFloat(formData.price);
      if (!isNaN(calculatedAmount)) {
        setFormData(prev => ({ ...prev, amount: calculatedAmount.toFixed(2) }));
      }
    }
  }, [formData.quantity, formData.price, formData.type]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{transaction ? 'Edit Transaction' : 'Add New Transaction'}</DialogTitle>
          <DialogDescription>
            {transaction ? 'Update the transaction details below.' : 'Enter the details for the new transaction.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Transaction Type *</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value as Transaction['type'] })}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Buy</SelectItem>
                  <SelectItem value="sell">Sell</SelectItem>
                  <SelectItem value="dividend">Dividend</SelectItem>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="withdrawal">Withdrawal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {needsAssetDetails && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assetName">Asset Name *</Label>
                  <Input
                    id="assetName"
                    value={formData.assetName}
                    onChange={(e) => setFormData({ ...formData, assetName: e.target.value })}
                    placeholder="e.g., Apple Inc., Bitcoin, VNQ"
                    required={needsAssetDetails}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assetClass">Asset Class *</Label>
                  <Select value={formData.assetClass || ''} onValueChange={(value) => setFormData({ ...formData, assetClass: value as Transaction['assetClass'] })}>
                    <SelectTrigger id="assetClass">
                      <SelectValue placeholder="Select asset class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stocks">Stocks</SelectItem>
                      <SelectItem value="bonds">Bonds</SelectItem>
                      <SelectItem value="real-estate">Real Estate</SelectItem>
                      <SelectItem value="crypto">Cryptocurrency</SelectItem>
                      <SelectItem value="commodities">Commodities</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(formData.type === 'buy' || formData.type === 'sell') && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      step="any"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="price">Price per Unit *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="any"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="broker">Broker</Label>
                  <Input
                    id="broker"
                    value={formData.broker}
                    onChange={(e) => setFormData({ ...formData, broker: e.target.value })}
                    placeholder="e.g., Fidelity, Charles Schwab"
                  />
                </div>

                {formData.assetClass === 'stocks' && (
                  <div className="space-y-2">
                    <Label htmlFor="exchange">Exchange</Label>
                    <Input
                      id="exchange"
                      value={formData.exchange}
                      onChange={(e) => setFormData({ ...formData, exchange: e.target.value })}
                      placeholder="e.g., NASDAQ, NYSE"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">
                Total Amount *
                {(formData.type === 'buy' || formData.type === 'sell') && formData.quantity && formData.price && (
                  <span className="text-xs text-gray-500 ml-2">(Auto-calculated)</span>
                )}
              </Label>
              <Input
                id="amount"
                type="number"
                step="any"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                required
                readOnly={(formData.type === 'buy' || formData.type === 'sell') && !!formData.quantity && !!formData.price}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="JPY">JPY</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Optional notes about this transaction"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {transaction ? 'Update Transaction' : 'Add Transaction'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
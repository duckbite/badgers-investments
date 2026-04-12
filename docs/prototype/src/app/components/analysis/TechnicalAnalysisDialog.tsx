import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export function TechnicalAnalysisDialog({ open, onClose, onSubmit }: Props) {
  const [symbol, setSymbol] = useState('');
  const [includePosition, setIncludePosition] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ symbol: symbol.toUpperCase(), includePosition });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Technical Analysis</DialogTitle>
          <DialogDescription>
            Chart patterns, indicators, and technical signals
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="symbol">Ticker Symbol</Label>
            <Input
              id="symbol"
              placeholder="NVDA"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              required
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="position"
              checked={includePosition}
              onCheckedChange={(checked) => setIncludePosition(checked as boolean)}
            />
            <label
              htmlFor="position"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Include my current position (if any)
            </label>
          </div>

          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
            <p className="text-sm text-indigo-900">
              Analysis includes:
            </p>
            <ul className="text-sm text-indigo-800 mt-2 space-y-1 list-disc list-inside">
              <li>Moving averages (SMA, EMA)</li>
              <li>RSI, MACD, Bollinger Bands</li>
              <li>Support and resistance levels</li>
              <li>Chart pattern recognition</li>
            </ul>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Run Analysis
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

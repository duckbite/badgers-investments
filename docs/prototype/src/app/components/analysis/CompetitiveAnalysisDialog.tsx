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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Button } from "../ui/button";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

const sectors = [
  'Technology', 'Healthcare', 'Financial Services', 'Consumer Cyclical',
  'Communication Services', 'Industrials', 'Consumer Defensive', 'Energy',
  'Utilities', 'Real Estate', 'Basic Materials'
];

export function CompetitiveAnalysisDialog({ open, onClose, onSubmit }: Props) {
  const [sector, setSector] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ sector });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Competitive Analysis</DialogTitle>
          <DialogDescription>
            Generate a competitive landscape report to find the best stock in a sector
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="sector">Select Sector</Label>
            <Select value={sector} onValueChange={setSector} required>
              <SelectTrigger id="sector">
                <SelectValue placeholder="Choose a sector" />
              </SelectTrigger>
              <SelectContent>
                {sectors.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-lg">
            <p className="text-sm text-cyan-900">
              Report will include:
            </p>
            <ul className="text-sm text-cyan-800 mt-2 space-y-1 list-disc list-inside">
              <li>Market leaders comparison</li>
              <li>Financial metrics benchmarking</li>
              <li>Growth potential analysis</li>
              <li>Investment recommendation</li>
            </ul>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={!sector}>
              Generate Report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

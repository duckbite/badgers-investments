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
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export function MacroImpactDialog({ open, onClose, onSubmit }: Props) {
  const [concern, setConcern] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ concern });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Macro Economic Impact Report</DialogTitle>
          <DialogDescription>
            Analyze how current economic conditions affect your portfolio
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="concern">What's your biggest economic concern?</Label>
            <Textarea
              id="concern"
              placeholder="e.g., Rising interest rates, inflation, recession fears, geopolitical tensions..."
              value={concern}
              onChange={(e) => setConcern(e.target.value)}
              rows={4}
              required
            />
          </div>

          <div className="p-4 bg-pink-50 border border-pink-200 rounded-lg">
            <p className="text-sm text-pink-900">
              Analysis will cover:
            </p>
            <ul className="text-sm text-pink-800 mt-2 space-y-1 list-disc list-inside">
              <li>Impact on your current holdings</li>
              <li>Sector vulnerability assessment</li>
              <li>Correlation with economic indicators</li>
              <li>Hedging strategies and recommendations</li>
            </ul>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Generate Report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

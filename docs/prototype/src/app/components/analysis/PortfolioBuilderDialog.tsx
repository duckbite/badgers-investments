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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export function PortfolioBuilderDialog({ open, onClose, onSubmit }: Props) {
  const [age, setAge] = useState('');
  const [income, setIncome] = useState('');
  const [savings, setSavings] = useState('');
  const [goals, setGoals] = useState('');
  const [riskTolerance, setRiskTolerance] = useState('moderate');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      age: parseInt(age),
      income: parseFloat(income),
      savings: parseFloat(savings),
      goals,
      riskTolerance
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Portfolio Builder</DialogTitle>
          <DialogDescription>
            Build a custom portfolio from scratch based on your personal situation
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="age">Age</Label>
            <Input
              id="age"
              type="number"
              placeholder="35"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="income">Annual Income ($)</Label>
            <Input
              id="income"
              type="number"
              placeholder="75000"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="savings">Available Savings ($)</Label>
            <Input
              id="savings"
              type="number"
              placeholder="50000"
              value={savings}
              onChange={(e) => setSavings(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goals">Investment Goals</Label>
            <Textarea
              id="goals"
              placeholder="e.g., Retirement savings, buying a house, children's education..."
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="risk">Risk Tolerance</Label>
            <Select value={riskTolerance} onValueChange={setRiskTolerance}>
              <SelectTrigger id="risk">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conservative">Conservative</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="aggressive">Aggressive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Build Portfolio
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

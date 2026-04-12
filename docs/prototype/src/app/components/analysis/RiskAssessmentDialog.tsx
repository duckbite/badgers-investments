import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

export function RiskAssessmentDialog({ open, onClose, onSubmit }: Props) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Portfolio Risk Assessment</DialogTitle>
          <DialogDescription>
            Generate a comprehensive risk analysis of your current holdings with heat map visualization
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-sm text-emerald-900">
              This analysis will evaluate all your current holdings and generate a detailed risk report including:
            </p>
            <ul className="text-sm text-emerald-800 mt-2 space-y-1 list-disc list-inside">
              <li>Portfolio diversification score</li>
              <li>Risk heat map by asset class</li>
              <li>Concentration risk analysis</li>
              <li>Recommended risk mitigation strategies</li>
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

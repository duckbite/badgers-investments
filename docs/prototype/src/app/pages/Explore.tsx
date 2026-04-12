import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Search,
  Calculator,
  AlertTriangle,
  TrendingUp,
  LineChart,
  Briefcase,
  BarChart3,
  Globe,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2
} from "lucide-react";
import { mockAnalyses } from "../data/analysisData";
import { StockScreenerDialog } from "../components/analysis/StockScreenerDialog";
import { DCFValuationDialog } from "../components/analysis/DCFValuationDialog";
import { RiskAssessmentDialog } from "../components/analysis/RiskAssessmentDialog";
import { EarningsAnalysisDialog } from "../components/analysis/EarningsAnalysisDialog";
import { TechnicalAnalysisDialog } from "../components/analysis/TechnicalAnalysisDialog";
import { PortfolioBuilderDialog } from "../components/analysis/PortfolioBuilderDialog";
import { CompetitiveAnalysisDialog } from "../components/analysis/CompetitiveAnalysisDialog";
import { MacroImpactDialog } from "../components/analysis/MacroImpactDialog";

const analysisTools = [
  {
    id: 'stock-screener',
    title: 'Stock Screener',
    description: 'Find the best stocks based on your criteria',
    icon: Search,
    color: 'bg-blue-100 text-blue-600',
  },
  {
    id: 'dcf-valuation',
    title: 'DCF Valuation',
    description: '5-year revenue projection with growth assumptions',
    icon: Calculator,
    color: 'bg-green-100 text-green-600',
  },
  {
    id: 'risk-assessment',
    title: 'Risk Assessment',
    description: 'Professional risk report with heat map summary',
    icon: AlertTriangle,
    color: 'bg-orange-100 text-orange-600',
  },
  {
    id: 'earnings-analysis',
    title: 'Earnings Analysis',
    description: 'Deep dive into company earnings performance',
    icon: TrendingUp,
    color: 'bg-purple-100 text-purple-600',
  },
  {
    id: 'technical-analysis',
    title: 'Technical Analysis',
    description: 'Chart patterns and technical indicators',
    icon: LineChart,
    color: 'bg-indigo-100 text-indigo-600',
  },
  {
    id: 'portfolio-builder',
    title: 'Portfolio Builder',
    description: 'Custom portfolio from scratch based on your goals',
    icon: Briefcase,
    color: 'bg-emerald-100 text-emerald-600',
  },
  {
    id: 'competitive-analysis',
    title: 'Competitive Analysis',
    description: 'Compare companies within a sector',
    icon: BarChart3,
    color: 'bg-cyan-100 text-cyan-600',
  },
  {
    id: 'macro-impact',
    title: 'Macro Impact Report',
    description: 'How economic conditions affect your portfolio',
    icon: Globe,
    color: 'bg-pink-100 text-pink-600',
  },
];

export default function Explore() {
  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState(mockAnalyses);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700">Completed</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-700">Processing</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700">Failed</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const formatAnalysisType = (type: string) => {
    return type
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Investment Analysis Tools</h2>
        <p className="text-gray-600 mt-1">
          Explore investment opportunities with professional analysis tools
        </p>
      </div>

      {/* Analysis Tools Grid */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Tools</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {analysisTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Card
                key={tool.id}
                className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-emerald-200"
                onClick={() => setActiveDialog(tool.id)}
              >
                <CardHeader className="pb-3">
                  <div className={`w-12 h-12 rounded-lg ${tool.color} flex items-center justify-center mb-3`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-base">{tool.title}</CardTitle>
                  <CardDescription className="text-sm">
                    {tool.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" size="sm">
                    Start Analysis
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent Analyses */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Analyses</h3>
          <Button variant="outline" size="sm">View All</Button>
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {analyses.map((analysis) => (
                <div key={analysis.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {getStatusIcon(analysis.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900">
                            {formatAnalysisType(analysis.type)}
                          </h4>
                          {getStatusBadge(analysis.status)}
                        </div>
                        <p className="text-sm text-gray-600">
                          Started: {new Date(analysis.createdAt).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        {analysis.completedAt && (
                          <p className="text-sm text-gray-500">
                            Completed: {new Date(analysis.completedAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                    {analysis.status === 'completed' && (
                      <Button variant="outline" size="sm">
                        View Report
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Dialogs */}
      <StockScreenerDialog
        open={activeDialog === 'stock-screener'}
        onClose={() => setActiveDialog(null)}
        onSubmit={(data) => {
          console.log('Stock screener:', data);
          setActiveDialog(null);
        }}
      />
      <DCFValuationDialog
        open={activeDialog === 'dcf-valuation'}
        onClose={() => setActiveDialog(null)}
        onSubmit={(data) => {
          console.log('DCF valuation:', data);
          setActiveDialog(null);
        }}
      />
      <RiskAssessmentDialog
        open={activeDialog === 'risk-assessment'}
        onClose={() => setActiveDialog(null)}
        onSubmit={() => {
          console.log('Risk assessment started');
          setActiveDialog(null);
        }}
      />
      <EarningsAnalysisDialog
        open={activeDialog === 'earnings-analysis'}
        onClose={() => setActiveDialog(null)}
        onSubmit={(data) => {
          console.log('Earnings analysis:', data);
          setActiveDialog(null);
        }}
      />
      <TechnicalAnalysisDialog
        open={activeDialog === 'technical-analysis'}
        onClose={() => setActiveDialog(null)}
        onSubmit={(data) => {
          console.log('Technical analysis:', data);
          setActiveDialog(null);
        }}
      />
      <PortfolioBuilderDialog
        open={activeDialog === 'portfolio-builder'}
        onClose={() => setActiveDialog(null)}
        onSubmit={(data) => {
          console.log('Portfolio builder:', data);
          setActiveDialog(null);
        }}
      />
      <CompetitiveAnalysisDialog
        open={activeDialog === 'competitive-analysis'}
        onClose={() => setActiveDialog(null)}
        onSubmit={(data) => {
          console.log('Competitive analysis:', data);
          setActiveDialog(null);
        }}
      />
      <MacroImpactDialog
        open={activeDialog === 'macro-impact'}
        onClose={() => setActiveDialog(null)}
        onSubmit={(data) => {
          console.log('Macro impact:', data);
          setActiveDialog(null);
        }}
      />
    </div>
  );
}

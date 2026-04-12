import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import {
  FileText,
  Download,
  Search,
  Filter,
  Clock,
  User
} from "lucide-react";
import { mockReports, type Report } from "../data/analysisData";

const reportTypeLabels: Record<string, string> = {
  'all': 'All Reports',
  'stock-screener': 'Stock Screener',
  'dcf-valuation': 'DCF Valuation',
  'risk-assessment': 'Risk Assessment',
  'earnings-analysis': 'Earnings Analysis',
  'technical-analysis': 'Technical Analysis',
  'portfolio-builder': 'Portfolio Builder',
  'competitive-analysis': 'Competitive Analysis',
  'macro-impact': 'Macro Impact',
};

export default function Library() {
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const myReports = mockReports.filter(r => r.createdBy === 'You');
  const otherReports = mockReports.filter(r => r.createdBy !== 'You');

  const filterReports = (reports: Report[]) => {
    return reports.filter(report => {
      const matchesType = filterType === 'all' || report.type === filterType;
      const matchesSearch = !searchQuery ||
        report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.summary.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  };

  const getReportTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'stock-screener': 'bg-blue-100 text-blue-700',
      'dcf-valuation': 'bg-green-100 text-green-700',
      'risk-assessment': 'bg-orange-100 text-orange-700',
      'earnings-analysis': 'bg-purple-100 text-purple-700',
      'technical-analysis': 'bg-indigo-100 text-indigo-700',
      'portfolio-builder': 'bg-emerald-100 text-emerald-700',
      'competitive-analysis': 'bg-cyan-100 text-cyan-700',
      'macro-impact': 'bg-pink-100 text-pink-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  const ReportCard = ({ report }: { report: Report }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              <CardTitle className="text-base">{report.title}</CardTitle>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={getReportTypeColor(report.type)}>
                {reportTypeLabels[report.type]}
              </Badge>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <User className="w-3 h-3" />
                <span>{report.createdBy}</span>
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Clock className="w-3 h-3" />
                <span>
                  {new Date(report.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" className="shrink-0">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 mb-3">{report.summary}</p>
        <div className="flex gap-2">
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" size="sm">
            View Report
          </Button>
          <Button variant="outline" size="sm">
            Share
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Report Library</h2>
        <p className="text-gray-600 mt-1">
          Access all generated investment analysis reports
        </p>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Report Types</SelectItem>
                  <SelectItem value="stock-screener">Stock Screener</SelectItem>
                  <SelectItem value="dcf-valuation">DCF Valuation</SelectItem>
                  <SelectItem value="risk-assessment">Risk Assessment</SelectItem>
                  <SelectItem value="earnings-analysis">Earnings Analysis</SelectItem>
                  <SelectItem value="technical-analysis">Technical Analysis</SelectItem>
                  <SelectItem value="portfolio-builder">Portfolio Builder</SelectItem>
                  <SelectItem value="competitive-analysis">Competitive Analysis</SelectItem>
                  <SelectItem value="macro-impact">Macro Impact</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Reports */}
      <Tabs defaultValue="my-reports" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="my-reports">
            My Reports ({filterReports(myReports).length})
          </TabsTrigger>
          <TabsTrigger value="all-reports">
            All Reports ({filterReports(otherReports).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-reports" className="space-y-4">
          {filterReports(myReports).length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filterReports(myReports).map((report) => (
                <ReportCard key={report.id} report={report} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">No reports found</p>
                <p className="text-sm text-gray-500">
                  {searchQuery || filterType !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Start by running an analysis from the Explore page'}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="all-reports" className="space-y-4">
          {filterReports(otherReports).length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filterReports(otherReports).map((report) => (
                <ReportCard key={report.id} report={report} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">No reports found</p>
                <p className="text-sm text-gray-500">
                  {searchQuery || filterType !== 'all'
                    ? 'Try adjusting your filters'
                    : 'No other users have shared reports yet'}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

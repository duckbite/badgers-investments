import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { mockRecommendations, type Recommendation } from "../data/mockData";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { AlertCircle, TrendingUp, TrendingDown, RefreshCw, Sparkles, CheckCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

export default function Recommendations() {
  const highPriorityRecs = mockRecommendations.filter(rec => rec.priority === 'high');
  const mediumPriorityRecs = mockRecommendations.filter(rec => rec.priority === 'medium');
  const lowPriorityRecs = mockRecommendations.filter(rec => rec.priority === 'low');

  const ruleBasedRecs = mockRecommendations.filter(rec => rec.generatedBy === 'rule');
  const aiGeneratedRecs = mockRecommendations.filter(rec => rec.generatedBy === 'ai');

  const getRecommendationIcon = (type: Recommendation['type']) => {
    switch (type) {
      case 'rebalance':
        return <RefreshCw className="w-5 h-5" />;
      case 'buy':
        return <TrendingUp className="w-5 h-5" />;
      case 'sell':
        return <TrendingDown className="w-5 h-5" />;
      case 'alert':
        return <AlertCircle className="w-5 h-5" />;
    }
  };

  const getPriorityColor = (priority: Recommendation['priority']) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 border-red-200 text-red-900';
      case 'medium':
        return 'bg-orange-100 border-orange-200 text-orange-900';
      case 'low':
        return 'bg-blue-100 border-blue-200 text-blue-900';
    }
  };

  const getPriorityBadgeVariant = (priority: Recommendation['priority']) => {
    switch (priority) {
      case 'high':
        return 'destructive' as const;
      case 'medium':
        return 'default' as const;
      case 'low':
        return 'secondary' as const;
    }
  };

  const RecommendationCard = ({ rec }: { rec: Recommendation }) => (
    <Card className={`${getPriorityColor(rec.priority)} border`}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
            rec.priority === 'high' ? 'bg-red-200' :
            rec.priority === 'medium' ? 'bg-orange-200' :
            'bg-blue-200'
          }`}>
            {getRecommendationIcon(rec.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h3 className="font-semibold text-lg mb-1">{rec.title}</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={getPriorityBadgeVariant(rec.priority)}>
                    {rec.priority} priority
                  </Badge>
                  <Badge variant="outline">
                    {rec.type}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    {rec.generatedBy === 'ai' && <Sparkles className="w-3 h-3" />}
                    {rec.generatedBy}
                  </Badge>
                  {rec.assetClass && (
                    <Badge variant="outline">
                      {rec.assetClass}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <p className="text-sm mb-3 leading-relaxed">{rec.description}</p>
            {rec.suggestedAction && (
              <div className="p-3 bg-white bg-opacity-50 rounded-lg mb-3">
                <p className="text-sm font-medium flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{rec.suggestedAction}</span>
                </p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-600">
                Generated on {new Date(rec.createdAt).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  Dismiss
                </Button>
                <Button size="sm">
                  Take Action
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Recommendations</h2>
          <p className="text-gray-600 mt-1">AI-powered and rule-based investment suggestions</p>
        </div>
        <Button className="gap-2">
          <Sparkles className="w-4 h-4" />
          Generate New Insights
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Recommendations</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold text-gray-900">{mockRecommendations.length}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>High Priority</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold text-red-600">{highPriorityRecs.length}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Rule-Based</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold text-gray-900">{ruleBasedRecs.length}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>AI-Generated</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <span className="text-3xl font-bold text-gray-900">{aiGeneratedRecs.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations Tabs */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">All ({mockRecommendations.length})</TabsTrigger>
          <TabsTrigger value="high">High Priority ({highPriorityRecs.length})</TabsTrigger>
          <TabsTrigger value="medium">Medium Priority ({mediumPriorityRecs.length})</TabsTrigger>
          <TabsTrigger value="low">Low Priority ({lowPriorityRecs.length})</TabsTrigger>
          <TabsTrigger value="rule">Rule-Based ({ruleBasedRecs.length})</TabsTrigger>
          <TabsTrigger value="ai">AI-Generated ({aiGeneratedRecs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {mockRecommendations.map(rec => (
            <RecommendationCard key={rec.id} rec={rec} />
          ))}
        </TabsContent>

        <TabsContent value="high" className="space-y-4">
          {highPriorityRecs.length > 0 ? (
            highPriorityRecs.map(rec => (
              <RecommendationCard key={rec.id} rec={rec} />
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <h3 className="font-semibold text-lg text-gray-900 mb-2">No High Priority Items</h3>
                <p className="text-gray-600">Great! You're on top of your critical recommendations.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="medium" className="space-y-4">
          {mediumPriorityRecs.map(rec => (
            <RecommendationCard key={rec.id} rec={rec} />
          ))}
        </TabsContent>

        <TabsContent value="low" className="space-y-4">
          {lowPriorityRecs.map(rec => (
            <RecommendationCard key={rec.id} rec={rec} />
          ))}
        </TabsContent>

        <TabsContent value="rule" className="space-y-4">
          {ruleBasedRecs.map(rec => (
            <RecommendationCard key={rec.id} rec={rec} />
          ))}
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          {aiGeneratedRecs.map(rec => (
            <RecommendationCard key={rec.id} rec={rec} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

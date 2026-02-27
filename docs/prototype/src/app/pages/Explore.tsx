import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { 
  Search, 
  TrendingUp, 
  TrendingDown, 
  MessageSquare, 
  Send,
  BarChart3,
  Sparkles
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Textarea } from "../components/ui/textarea";

export default function Explore() {
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'ai'; content: string }>>([
    {
      role: 'ai',
      content: 'Hello! I\'m your AI investment assistant. I can help you understand your portfolio, explain recommendations, and answer questions about your investments. How can I help you today?'
    }
  ]);
  const [chatInput, setChatInput] = useState("");

  // Mock investment opportunities
  const opportunities = [
    {
      symbol: "NVDA",
      name: "NVIDIA Corporation",
      sector: "Technology",
      price: 875.28,
      change: 2.34,
      changePercent: 2.7,
      score: 85,
      reason: "Strong AI chip demand, growing data center revenue"
    },
    {
      symbol: "JPM",
      name: "JPMorgan Chase",
      sector: "Financial",
      price: 185.42,
      change: -0.82,
      changePercent: -0.44,
      score: 78,
      reason: "Solid earnings, high dividend yield, strong balance sheet"
    },
    {
      symbol: "TSLA",
      name: "Tesla Inc",
      sector: "Automotive",
      price: 248.50,
      change: 5.23,
      changePercent: 2.15,
      score: 72,
      reason: "EV market leader, expanding production capacity"
    },
    {
      symbol: "JNJ",
      name: "Johnson & Johnson",
      sector: "Healthcare",
      price: 162.18,
      change: 0.45,
      changePercent: 0.28,
      score: 80,
      reason: "Defensive stock, consistent dividends, diversified portfolio"
    },
  ];

  // Mock technical analysis data
  const technicalData = {
    priceHistory: [
      { date: "Jan 01", price: 850, volume: 45000000 },
      { date: "Jan 05", price: 862, volume: 52000000 },
      { date: "Jan 10", price: 848, volume: 48000000 },
      { date: "Jan 15", price: 870, volume: 55000000 },
      { date: "Jan 20", price: 863, volume: 49000000 },
      { date: "Jan 25", price: 875, volume: 51000000 },
    ],
    indicators: {
      rsi: 58.4,
      macd: "Bullish",
      movingAvg50: 862.5,
      movingAvg200: 845.2,
      support: 845,
      resistance: 890
    }
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatInput("");

    // Simulate AI response
    setTimeout(() => {
      let aiResponse = "";
      
      if (userMessage.toLowerCase().includes("portfolio")) {
        aiResponse = "Your portfolio is currently valued at $82,145 with a 15.2% gain. You have a well-diversified allocation across stocks (45%), bonds (20%), real estate (15%), crypto (10%), and other assets. Your technology sector exposure is healthy at 22.5% of your stock holdings.";
      } else if (userMessage.toLowerCase().includes("recommendation")) {
        aiResponse = "I've generated 3 high-priority recommendations for you: 1) Consider rebalancing your tech holdings as they've exceeded your target allocation. 2) Your bond allocation is below the recommended level for a moderate risk profile. 3) AAPL has significant unrealized gains - you might want to consider taking some profits.";
      } else if (userMessage.toLowerCase().includes("risk")) {
        aiResponse = "Based on your moderate risk appetite, your current portfolio volatility is slightly above optimal. I recommend increasing your bond allocation by 5% and reducing crypto exposure. This would bring your risk profile in line with your preferences while maintaining strong growth potential.";
      } else {
        aiResponse = "I understand you're asking about " + userMessage + ". Based on your portfolio and investment profile, I recommend focusing on diversification and maintaining a balanced approach. Would you like me to analyze a specific aspect of your investments?";
      }

      setChatMessages(prev => [...prev, { role: 'ai', content: aiResponse }]);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Explore Investments</h2>
        <p className="text-gray-600 mt-1">Discover opportunities, analyze stocks, and get AI-powered insights</p>
      </div>

      <Tabs defaultValue="opportunities" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="opportunities">Investment Opportunities</TabsTrigger>
          <TabsTrigger value="analysis">Technical Analysis</TabsTrigger>
          <TabsTrigger value="chat">AI Assistant</TabsTrigger>
        </TabsList>

        {/* Investment Opportunities Tab */}
        <TabsContent value="opportunities" className="space-y-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input 
                placeholder="Search for stocks, sectors, or opportunities..." 
                className="pl-10"
              />
            </div>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {opportunities.map((opp) => (
              <Card key={opp.symbol} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{opp.symbol}</CardTitle>
                      <CardDescription>{opp.name}</CardDescription>
                    </div>
                    <Badge variant="outline">{opp.sector}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">${opp.price.toFixed(2)}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {opp.change >= 0 ? (
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-600" />
                        )}
                        <span className={`text-sm font-medium ${opp.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${Math.abs(opp.change).toFixed(2)} ({Math.abs(opp.changePercent).toFixed(2)}%)
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600 mb-1">Opportunity Score</p>
                      <div className={`text-2xl font-bold ${
                        opp.score >= 80 ? 'text-green-600' : 
                        opp.score >= 70 ? 'text-yellow-600' : 
                        'text-gray-600'
                      }`}>
                        {opp.score}
                      </div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600">{opp.reason}</p>
                  </div>
                  <Button 
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => setSelectedStock(opp.symbol)}
                  >
                    View Analysis
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Technical Analysis Tab */}
        <TabsContent value="analysis" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Technical Analysis</CardTitle>
                  <CardDescription>Advanced charting and indicators</CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input 
                    placeholder="Enter stock symbol..." 
                    className="pl-10 w-64"
                    defaultValue={selectedStock || ""}
                  />
                </div>
              </div>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Price Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Price History</CardTitle>
                <CardDescription>30-day price movement</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={technicalData.priceHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={['dataMin - 10', 'dataMax + 10']} />
                    <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                    <Line type="monotone" dataKey="price" stroke="#059669" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Volume Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Trading Volume</CardTitle>
                <CardDescription>30-day volume trend</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={technicalData.priceHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => value.toLocaleString()} />
                    <Bar dataKey="volume" fill="#059669" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Technical Indicators */}
          <Card>
            <CardHeader>
              <CardTitle>Technical Indicators</CardTitle>
              <CardDescription>Key metrics and signals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-gray-600 mb-1">RSI (14)</p>
                  <p className="text-2xl font-bold">{technicalData.indicators.rsi}</p>
                  <Badge variant="outline" className="mt-2">Neutral</Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">MACD</p>
                  <p className="text-2xl font-bold">{technicalData.indicators.macd}</p>
                  <Badge className="mt-2 bg-green-100 text-green-800">Bullish</Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">50-Day MA</p>
                  <p className="text-2xl font-bold">${technicalData.indicators.movingAvg50}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">200-Day MA</p>
                  <p className="text-2xl font-bold">${technicalData.indicators.movingAvg200}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Support Level</p>
                  <p className="text-2xl font-bold">${technicalData.indicators.support}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Resistance Level</p>
                  <p className="text-2xl font-bold">${technicalData.indicators.resistance}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Chat Tab */}
        <TabsContent value="chat" className="space-y-6">
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                <CardTitle>AI Investment Assistant</CardTitle>
              </div>
              <CardDescription>Ask questions about your portfolio and get personalized recommendations</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-4">
                {chatMessages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-3 ${
                        message.role === 'user'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {message.role === 'ai' && (
                          <Sparkles className="w-4 h-4 mt-1 flex-shrink-0" />
                        )}
                        <p className="text-sm">{message.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Suggested Questions */}
              <div className="mb-4 space-y-2">
                <p className="text-sm text-gray-600">Suggested questions:</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setChatInput("How is my portfolio performing?")}
                  >
                    How is my portfolio performing?
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setChatInput("Explain my high-priority recommendations")}
                  >
                    Explain my recommendations
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setChatInput("Should I adjust my risk level?")}
                  >
                    Should I adjust my risk?
                  </Button>
                </div>
              </div>

              {/* Chat Input */}
              <div className="flex gap-2">
                <Textarea
                  placeholder="Ask me anything about your investments..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1 min-h-[60px] max-h-[120px]"
                />
                <Button
                  onClick={handleSendMessage}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

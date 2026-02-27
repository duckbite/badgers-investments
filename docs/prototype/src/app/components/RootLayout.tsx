import { Outlet, Link, useLocation } from "react-router";
import { LayoutDashboard, Wallet, BookOpen, TrendingUp, Lightbulb, User, Moon, Sun, DollarSign, Compass } from "lucide-react";
import badgersLogo from "figma:asset/3ee6fb8dc3db20112c717dba8d1a4057e4616e05.png";
import { useState } from "react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";

export function RootLayout() {
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [riskAppetite, setRiskAppetite] = useState("moderate");
  const [investmentProfile, setInvestmentProfile] = useState("balanced");

  const navItems = [
    { path: "/", label: "Dashboard", icon: LayoutDashboard },
    { path: "/assets", label: "Assets", icon: Wallet },
    { path: "/ledger", label: "Ledger", icon: BookOpen },
    { path: "/performance", label: "Performance", icon: TrendingUp },
    { path: "/recommendations", label: "Recommendations", icon: Lightbulb },
    { path: "/explore", label: "Explore", icon: Compass },
  ];

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <img src={badgersLogo} alt="Badgers Finance" className="h-16" />
            </div>
            
            {/* Top Right Controls */}
            <div className="flex items-center gap-3">
              {/* Currency Selector */}
              <Select value={baseCurrency} onValueChange={setBaseCurrency}>
                <SelectTrigger className="w-32 border-gray-300">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                  <SelectItem value="JPY">JPY (¥)</SelectItem>
                  <SelectItem value="AUD">AUD (A$)</SelectItem>
                  <SelectItem value="CAD">CAD (C$)</SelectItem>
                </SelectContent>
              </Select>

              {/* Dark Mode Toggle */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setDarkMode(!darkMode)}
                className="border-gray-300"
              >
                {darkMode ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </Button>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="border-gray-300">
                    <User className="w-4 h-4 mr-2" />
                    Account
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setPreferencesOpen(true)}>
                    Settings & Preferences
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Sign Out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="px-6">
          <div className="flex gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    active
                      ? "border-emerald-600 text-emerald-600"
                      : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="px-6 py-6">
        <Outlet />
      </main>

      {/* Preferences Dialog */}
      <Dialog open={preferencesOpen} onOpenChange={setPreferencesOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Preferences</DialogTitle>
            <DialogDescription>
              Manage your account preferences.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Dark Mode</Label>
              <RadioGroup
                value={darkMode ? "dark" : "light"}
                onValueChange={(value) => setDarkMode(value === "dark")}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="dark" />
                  Dark
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="light" />
                  Light
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>Base Currency</Label>
              <Select
                value={baseCurrency}
                onValueChange={(value) => setBaseCurrency(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="JPY">JPY</SelectItem>
                  <SelectItem value="AUD">AUD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Risk Appetite</Label>
              <Select
                value={riskAppetite}
                onValueChange={(value) => setRiskAppetite(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a risk appetite" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conservative">Conservative</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="aggressive">Aggressive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Investment Profile</Label>
              <Select
                value={investmentProfile}
                onValueChange={(value) => setInvestmentProfile(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an investment profile" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="growth">Growth</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button
              type="button"
              className="bg-emerald-600 text-white"
              onClick={() => setPreferencesOpen(false)}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
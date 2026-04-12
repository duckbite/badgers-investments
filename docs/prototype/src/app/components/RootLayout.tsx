import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { LayoutDashboard, Wallet, BookOpen, TrendingUp, Lightbulb, User, Moon, Sun, DollarSign, Compass, Eye, EyeOff, BookMarked } from "lucide-react";
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
  DialogFooter,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Checkbox } from "./ui/checkbox";
import { AnonymizeProvider, useAnonymize } from "../contexts/AnonymizeContext";
import { useAuth } from "../contexts/AuthContext";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "./ui/input-otp";
import { toast } from "sonner";

function RootLayoutContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [darkMode, setDarkMode] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [riskAppetiteOpen, setRiskAppetiteOpen] = useState(false);
  const [riskAppetite, setRiskAppetite] = useState("moderate");
  const [investmentProfile, setInvestmentProfile] = useState("balanced");
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState("");
  const { isAnonymized, setIsAnonymized } = useAnonymize();

  // Default PIN for demo purposes: 1234
  // In a production app, this would be stored securely and user-configurable
  const DEFAULT_PIN = "1234";

  const handleAnonymizeToggle = () => {
    if (isAnonymized) {
      // Trying to show amounts - require PIN
      setPinDialogOpen(true);
      setPinValue("");
      setPinError("");
    } else {
      // Hiding amounts - quick action
      setIsAnonymized(true);
    }
  };

  const handlePinSubmit = () => {
    if (pinValue === DEFAULT_PIN) {
      setIsAnonymized(false);
      setPinDialogOpen(false);
      setPinValue("");
      setPinError("");
    } else {
      setPinError("Incorrect PIN. Please try again.");
      setPinValue("");
    }
  };

  const handlePinComplete = (value: string) => {
    setPinValue(value);
  };

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully", {
      description: "See you soon!",
    });
    navigate("/login");
  };

  const navItems = [
    { path: "/", label: "Dashboard", icon: LayoutDashboard },
    { path: "/assets", label: "Assets", icon: Wallet },
    { path: "/ledger", label: "Ledger", icon: BookOpen },
    { path: "/performance", label: "Performance", icon: TrendingUp },
    { path: "/recommendations", label: "Recommendations", icon: Lightbulb },
    { path: "/explore", label: "Explore", icon: Compass },
    { path: "/library", label: "Library", icon: BookMarked },
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

              {/* Anonymize Toggle */}
              <Button
                variant="outline"
                size="icon"
                onClick={handleAnonymizeToggle}
                className="border-gray-300"
                title={isAnonymized ? "Show amounts (requires PIN)" : "Hide amounts"}
              >
                {isAnonymized ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>

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
                  <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRiskAppetiteOpen(true)}>
                    Risk Appetite
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPreferencesOpen(true)}>
                    Preferences
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>Sign Out</DropdownMenuItem>
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

      {/* Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Profile</DialogTitle>
            <DialogDescription>
              Manage your personal information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" placeholder="John" defaultValue="John" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" placeholder="Doe" defaultValue="Doe" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="john.doe@example.com" defaultValue="demo@badgers.finance" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" type="tel" placeholder="+1 (555) 123-4567" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" placeholder="123 Main St, City, State, ZIP" />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setProfileOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                toast.success("Profile updated successfully");
                setProfileOpen(false);
              }}
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Risk Appetite Dialog */}
      <Dialog open={riskAppetiteOpen} onOpenChange={setRiskAppetiteOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Risk Appetite Assessment</DialogTitle>
            <DialogDescription>
              Answer these questions to determine your investment risk profile
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-3">
              <Label>How would you react if your portfolio dropped 20% in a month?</Label>
              <RadioGroup defaultValue="moderate">
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="conservative" id="q1-conservative" />
                  <label htmlFor="q1-conservative" className="text-sm leading-relaxed cursor-pointer">
                    I'd panic and sell everything 😰
                  </label>
                </div>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="moderate" id="q1-moderate" />
                  <label htmlFor="q1-moderate" className="text-sm leading-relaxed cursor-pointer">
                    I'd be concerned but hold steady 😬
                  </label>
                </div>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="aggressive" id="q1-aggressive" />
                  <label htmlFor="q1-aggressive" className="text-sm leading-relaxed cursor-pointer">
                    I'd buy more while it's down! 🚀
                  </label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>What's your investment time horizon?</Label>
              <RadioGroup defaultValue="moderate">
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="conservative" id="q2-conservative" />
                  <label htmlFor="q2-conservative" className="text-sm leading-relaxed cursor-pointer">
                    Less than 3 years ⏰
                  </label>
                </div>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="moderate" id="q2-moderate" />
                  <label htmlFor="q2-moderate" className="text-sm leading-relaxed cursor-pointer">
                    3-10 years 📅
                  </label>
                </div>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="aggressive" id="q2-aggressive" />
                  <label htmlFor="q2-aggressive" className="text-sm leading-relaxed cursor-pointer">
                    10+ years, I'm playing the long game! 🎯
                  </label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>Which investment sounds most appealing?</Label>
              <RadioGroup defaultValue="moderate">
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="conservative" id="q3-conservative" />
                  <label htmlFor="q3-conservative" className="text-sm leading-relaxed cursor-pointer">
                    Bonds & dividend stocks - steady and reliable 💰
                  </label>
                </div>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="moderate" id="q3-moderate" />
                  <label htmlFor="q3-moderate" className="text-sm leading-relaxed cursor-pointer">
                    Mix of stocks and bonds - balanced approach 📊
                  </label>
                </div>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="aggressive" id="q3-aggressive" />
                  <label htmlFor="q3-aggressive" className="text-sm leading-relaxed cursor-pointer">
                    Growth stocks & crypto - high risk, high reward! 🎲
                  </label>
                </div>
              </RadioGroup>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-sm font-medium text-emerald-900">
                Current Risk Profile: <span className="font-bold">Moderate</span>
              </p>
              <p className="text-sm text-emerald-700 mt-1">
                You prefer balanced growth with manageable risk levels
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setRiskAppetiteOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                toast.success("Risk appetite updated");
                setRiskAppetiteOpen(false);
              }}
            >
              Save Assessment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preferences Dialog */}
      <Dialog open={preferencesOpen} onOpenChange={setPreferencesOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Investment Preferences</DialogTitle>
            <DialogDescription>
              Set your market and sector preferences
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-3">
              <Label>Preferred Markets</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox id="market-us" defaultChecked />
                  <label htmlFor="market-us" className="text-sm font-medium">
                    US Markets (NYSE, NASDAQ)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="market-eu" />
                  <label htmlFor="market-eu" className="text-sm font-medium">
                    European Markets
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="market-asia" />
                  <label htmlFor="market-asia" className="text-sm font-medium">
                    Asian Markets
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="market-crypto" defaultChecked />
                  <label htmlFor="market-crypto" className="text-sm font-medium">
                    Cryptocurrency
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Sectors to Avoid</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox id="avoid-tobacco" defaultChecked />
                  <label htmlFor="avoid-tobacco" className="text-sm font-medium">
                    Tobacco
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="avoid-weapons" />
                  <label htmlFor="avoid-weapons" className="text-sm font-medium">
                    Defense/Weapons
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="avoid-gambling" />
                  <label htmlFor="avoid-gambling" className="text-sm font-medium">
                    Gambling
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="avoid-fossil" defaultChecked />
                  <label htmlFor="avoid-fossil" className="text-sm font-medium">
                    Fossil Fuels
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="esg">ESG (Environmental, Social, Governance) Priority</Label>
              <Select defaultValue="medium">
                <SelectTrigger id="esg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not a priority</SelectItem>
                  <SelectItem value="low">Low priority</SelectItem>
                  <SelectItem value="medium">Medium priority</SelectItem>
                  <SelectItem value="high">High priority - ESG focused</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setPreferencesOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                toast.success("Preferences saved successfully");
                setPreferencesOpen(false);
              }}
            >
              Save Preferences
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PIN Dialog */}
      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent className="sm:max-w-[340px]">
          <DialogHeader>
            <DialogTitle>Enter PIN</DialogTitle>
            <DialogDescription>
              Enter your 4-digit PIN to show amounts
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <InputOTP
              maxLength={4}
              value={pinValue}
              onChange={handlePinComplete}
              onComplete={handlePinComplete}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
              </InputOTPGroup>
            </InputOTP>
            {pinError && (
              <p className="text-sm text-red-600">{pinError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPinDialogOpen(false);
                setPinValue("");
                setPinError("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handlePinSubmit}
              disabled={pinValue.length !== 4}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function RootLayout() {
  return (
    <AnonymizeProvider>
      <RootLayoutContent />
    </AnonymizeProvider>
  );
}
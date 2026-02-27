import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/RootLayout";
import Dashboard from "./pages/Dashboard";
import Assets from "./pages/Assets";
import Ledger from "./pages/Ledger";
import Performance from "./pages/Performance";
import Recommendations from "./pages/Recommendations";
import Explore from "./pages/Explore";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: "assets", Component: Assets },
      { path: "ledger", Component: Ledger },
      { path: "performance", Component: Performance },
      { path: "recommendations", Component: Recommendations },
      { path: "explore", Component: Explore },
    ],
  },
]);
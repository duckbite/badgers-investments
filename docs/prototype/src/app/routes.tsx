import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Assets from "./pages/Assets";
import Ledger from "./pages/Ledger";
import Performance from "./pages/Performance";
import Recommendations from "./pages/Recommendations";
import Explore from "./pages/Explore";
import Library from "./pages/Library";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <RootLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, Component: Dashboard },
      { path: "assets", Component: Assets },
      { path: "ledger", Component: Ledger },
      { path: "performance", Component: Performance },
      { path: "recommendations", Component: Recommendations },
      { path: "explore", Component: Explore },
      { path: "library", Component: Library },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/login" replace />,
  },
]);
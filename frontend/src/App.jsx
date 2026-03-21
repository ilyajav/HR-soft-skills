import { Navigate, Route, Routes } from "react-router-dom";
import { Space, Switch, Typography } from "antd";
import Dashboard from "./pages/Dashboard";
import GlobalStats from "./pages/GlobalStats";
import Login from "./pages/Login";
import Play from "./pages/Play";
import Results from "./pages/Results";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("hr_token");
  return token ? children : <Navigate to="/login" replace />;
}

export default function App({ themeMode, onThemeChange }) {
  const hasToken = Boolean(localStorage.getItem("hr_token"));

  return (
    <>
      <div className="theme-toggle-shell">
        <Space size="small" align="center">
          <Typography.Text className="theme-toggle-label">
            {themeMode === "dark" ? "Темный режим" : "Светлый режим"}
          </Typography.Text>
          <Switch
            checked={themeMode === "dark"}
            onChange={onThemeChange}
          />
        </Space>
      </div>

      <Routes>
        <Route
          path="/"
          element={<Navigate to={hasToken ? "/dashboard" : "/login"} replace />}
        />
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/statistics"
          element={
            <ProtectedRoute>
              <GlobalStats />
            </ProtectedRoute>
          }
        />
        <Route
          path="/results/:sessionId"
          element={
            <ProtectedRoute>
              <Results />
            </ProtectedRoute>
          }
        />
        <Route path="/play/:token" element={<Play />} />
        <Route
          path="*"
          element={<Navigate to={hasToken ? "/dashboard" : "/login"} replace />}
        />
      </Routes>
    </>
  );
}

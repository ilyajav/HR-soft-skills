import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Space, Switch, Typography } from "antd";
import AdminAssessmentProfiles from "./pages/AdminAssessmentProfiles";
import AdminDashboard from "./pages/AdminDashboard";
import AdminHRUsers from "./pages/AdminHRUsers";
import Dashboard from "./pages/Dashboard";
import GlobalStats from "./pages/GlobalStats";
import Login from "./pages/Login";
import Play from "./pages/Play";
import Results from "./pages/Results";
import {
  ADMIN_HOME_PATH,
  ADMIN_HR_USERS_PATH,
  ADMIN_PROFILES_PATH,
  HR_HOME_PATH,
  getHomePathForRole,
  getStoredUserRole,
  hasAuthToken,
} from "./auth";
import type { UserRole } from "./auth";
import type { ThemeMode } from "./types";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole;
}

interface AppProps {
  themeMode: ThemeMode;
  onThemeChange: (checked: boolean) => void;
}

function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  if (!hasAuthToken()) {
    return <Navigate to="/login" replace />;
  }

  const role = getStoredUserRole();
  if (requiredRole === "admin" && role !== "admin") {
    return <Navigate to={HR_HOME_PATH} replace />;
  }

  if (requiredRole === "hr" && role === "admin") {
    return <Navigate to={ADMIN_HOME_PATH} replace />;
  }

  return children;
}

export default function App({ themeMode, onThemeChange }: AppProps) {
  const homePath = hasAuthToken() ? getHomePathForRole() : "/login";

  return (
    <>
      <div className="theme-toggle-shell">
        <Space size="small" align="center">
          <Typography.Text className="theme-toggle-label">
            {themeMode === "dark" ? "Темный режим" : "Светлый режим"}
          </Typography.Text>
          <Switch checked={themeMode === "dark"} onChange={onThemeChange} />
        </Space>
      </div>

      <Routes>
        <Route path="/" element={<Navigate to={homePath} replace />} />
        <Route path="/login" element={<Login />} />
        <Route
          path={ADMIN_HOME_PATH}
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path={ADMIN_HR_USERS_PATH}
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminHRUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path={ADMIN_PROFILES_PATH}
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminAssessmentProfiles />
            </ProtectedRoute>
          }
        />
        <Route
          path={HR_HOME_PATH}
          element={
            <ProtectedRoute requiredRole="hr">
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/statistics"
          element={
            <ProtectedRoute requiredRole="hr">
              <GlobalStats />
            </ProtectedRoute>
          }
        />
        <Route
          path="/results/:sessionId"
          element={
            <ProtectedRoute requiredRole="hr">
              <Results />
            </ProtectedRoute>
          }
        />
        <Route path="/play/:token" element={<Play />} />
        <Route path="*" element={<Navigate to={homePath} replace />} />
      </Routes>
    </>
  );
}

import { StrictMode, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider, theme as antdTheme } from "antd";
import type { ThemeConfig } from "antd";
import ruRU from "antd/locale/ru_RU";
import "antd/dist/reset.css";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./main.css";
import type { ThemeMode } from "./types";

const THEME_STORAGE_KEY = "ui_theme_mode";

const getInitialThemeMode = (): ThemeMode => {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

function Root() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  const configTheme = useMemo<ThemeConfig>(
    () => ({
      algorithm: themeMode === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: "#1768ac",
        colorInfo: "#1768ac",
        colorSuccess: "#2f855a",
        colorWarning: "#b7791f",
        colorError: "#c53030",
        borderRadius: 16,
        fontFamily:
          '"Segoe UI", "Inter", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
      },
    }),
    [themeMode],
  );

  return (
    <ConfigProvider locale={ruRU} theme={configTheme}>
      <BrowserRouter>
        <App
          themeMode={themeMode}
          onThemeChange={(checked) => setThemeMode(checked ? "dark" : "light")}
        />
      </BrowserRouter>
    </ConfigProvider>
  );
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);

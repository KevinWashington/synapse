import { useEffect, useState } from "react";

const THEME_CHANGE_EVENT = "synapse-theme-change";
const THEME_COLOR_STORAGE_KEY = "synapse-theme-color";

const THEME_COLOR_PRESETS = {
  blue: {
    label: "Azul",
    accent: "#3b82f6",
    chartCurrent: "#3b82f6",
    badgeBlueBg: "#dbeafe",
    badgeBlueText: "#1e40af",
  },
  emerald: {
    label: "Esmeralda",
    accent: "#10b981",
    chartCurrent: "#10b981",
    badgeBlueBg: "#d1fae5",
    badgeBlueText: "#065f46",
  },
  amber: {
    label: "Âmbar",
    accent: "#f59e0b",
    chartCurrent: "#f59e0b",
    badgeBlueBg: "#fef3c7",
    badgeBlueText: "#92400e",
  },
  rose: {
    label: "Rosa",
    accent: "#f43f5e",
    chartCurrent: "#f43f5e",
    badgeBlueBg: "#ffe4e6",
    badgeBlueText: "#be123c",
  },
  violet: {
    label: "Violeta",
    accent: "#8b5cf6",
    chartCurrent: "#8b5cf6",
    badgeBlueBg: "#ede9fe",
    badgeBlueText: "#5b21b6",
  },
};

function getCurrentTheme() {
  if (typeof document === "undefined") {
    return "light";
  }

  return document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";
}

function applyTheme(theme) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  document.documentElement.classList.toggle("dark", theme === "dark");
  window.localStorage.setItem("theme", theme);
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT));
}

function getCurrentThemeColor() {
  if (typeof window === "undefined") {
    return "blue";
  }

  const stored = window.localStorage.getItem(THEME_COLOR_STORAGE_KEY) || "blue";
  return THEME_COLOR_PRESETS[stored] ? stored : "blue";
}

function applyThemeColor(colorName) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const normalized = THEME_COLOR_PRESETS[colorName] ? colorName : "blue";
  const preset = THEME_COLOR_PRESETS[normalized];

  document.documentElement.style.setProperty("--syn-sidebar-accent", preset.accent);
  document.documentElement.style.setProperty("--syn-chart-current", preset.chartCurrent);
  document.documentElement.style.setProperty("--syn-badge-blue-bg", preset.badgeBlueBg);
  document.documentElement.style.setProperty("--syn-badge-blue-text", preset.badgeBlueText);
  window.localStorage.setItem(THEME_COLOR_STORAGE_KEY, normalized);
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT));
}

function useThemePreference() {
  const [theme, setThemeState] = useState(getCurrentTheme);
  const [themeColor, setThemeColorState] = useState(getCurrentThemeColor);

  useEffect(() => {
    applyThemeColor(themeColor);
  }, [themeColor]);

  useEffect(() => {
    function syncTheme() {
      setThemeState(getCurrentTheme());
      setThemeColorState(getCurrentThemeColor());
    }

    window.addEventListener(THEME_CHANGE_EVENT, syncTheme);
    window.addEventListener("storage", syncTheme);

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, syncTheme);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  function setTheme(nextTheme) {
    applyTheme(nextTheme);
    setThemeState(nextTheme);
  }

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  function setThemeColor(nextColor) {
    const normalized = THEME_COLOR_PRESETS[nextColor] ? nextColor : "blue";
    applyThemeColor(normalized);
    setThemeColorState(normalized);
  }

  const themeColorOptions = Object.entries(THEME_COLOR_PRESETS).map(
    ([value, preset]) => ({
      value,
      label: preset.label,
      accent: preset.accent,
    })
  );

  return {
    theme,
    themeColor,
    themeColorOptions,
    isDark: theme === "dark",
    setTheme,
    setThemeColor,
    toggleTheme,
  };
}

export default useThemePreference;

import { useEffect, useState } from "react";

const THEME_CHANGE_EVENT = "synapse-theme-change";

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

function useThemePreference() {
  const [theme, setThemeState] = useState(getCurrentTheme);

  useEffect(() => {
    function syncTheme() {
      setThemeState(getCurrentTheme());
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

  return {
    theme,
    isDark: theme === "dark",
    setTheme,
    toggleTheme,
  };
}

export default useThemePreference;

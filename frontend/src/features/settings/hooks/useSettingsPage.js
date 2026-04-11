import { useState } from "react";
import { useAIConfig } from "@features/ai";
import useThemePreference from "@hooks/useThemePreference";

function useSettingsPage() {
  const {
    aiProvider,
    ollamaConfig,
    geminiConfig,
    updateAiProvider,
    updateOllamaConfig,
    updateGeminiConfig,
  } = useAIConfig();
  const { isDark, toggleTheme } = useThemePreference();
  const [showOllamaConfig, setShowOllamaConfig] = useState(false);
  const [showGeminiConfig, setShowGeminiConfig] = useState(false);

  function handleAiProviderChange(provider) {
    updateAiProvider(provider);
  }

  function handleGeminiConfigToggle() {
    setShowGeminiConfig((previousValue) => !previousValue);
  }

  function handleOllamaConfigToggle() {
    setShowOllamaConfig((previousValue) => !previousValue);
  }

  return {
    aiProvider,
    activeProviderLabel:
      aiProvider === "gemini" ? "Google Gemini" : "Ollama (Local)",
    geminiConfig,
    isDark,
    ollamaConfig,
    showGeminiConfig,
    showOllamaConfig,
    toggleGeminiConfig: handleGeminiConfigToggle,
    toggleOllamaConfig: handleOllamaConfigToggle,
    toggleTheme,
    updateAiProvider: handleAiProviderChange,
    updateGeminiConfig,
    updateOllamaConfig,
  };
}

export default useSettingsPage;

import AIProviderSettingsCard from "./AIProviderSettingsCard";
import ThemePreferenceCard from "./ThemePreferenceCard";
import useSettingsPage from "../hooks/useSettingsPage";

function SettingsPageContent() {
  const {
    activeProviderLabel,
    aiProvider,
    geminiConfig,
    isDark,
    ollamaConfig,
    showGeminiConfig,
    showOllamaConfig,
    toggleGeminiConfig,
    toggleOllamaConfig,
    toggleTheme,
    updateAiProvider,
    updateGeminiConfig,
    updateOllamaConfig,
  } = useSettingsPage();

  return (
    <div className="space-y-6">
      <ThemePreferenceCard isDark={isDark} onToggleTheme={toggleTheme} />

      <AIProviderSettingsCard
        activeProviderLabel={activeProviderLabel}
        aiProvider={aiProvider}
        geminiConfig={geminiConfig}
        ollamaConfig={ollamaConfig}
        onAiProviderChange={updateAiProvider}
        onGeminiConfigChange={updateGeminiConfig}
        onOllamaConfigChange={updateOllamaConfig}
        onToggleGeminiConfig={toggleGeminiConfig}
        onToggleOllamaConfig={toggleOllamaConfig}
        showGeminiConfig={showGeminiConfig}
        showOllamaConfig={showOllamaConfig}
      />
    </div>
  );
}

export default SettingsPageContent;

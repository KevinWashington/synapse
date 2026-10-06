import ThemePreferenceCard from "./ThemePreferenceCard";
import DeepSeekKeyCard from "./DeepSeekKeyCard";
import useSettingsPage from "../hooks/useSettingsPage";

function SettingsPageContent() {
  const {
    themeColor,
    themeColorOptions,
    updateThemeColor,
    deepSeekStatus,
    deepSeekLoading,
    deepSeekSaving,
    deepSeekError,
    deepSeekNotice,
    saveDeepSeekKey,
    deleteDeepSeekKey,
  } = useSettingsPage();

  return (
    <div className="space-y-6">
      <DeepSeekKeyCard
        status={deepSeekStatus}
        loading={deepSeekLoading}
        saving={deepSeekSaving}
        error={deepSeekError}
        notice={deepSeekNotice}
        onSave={saveDeepSeekKey}
        onDelete={deleteDeepSeekKey}
      />
      <ThemePreferenceCard
        onThemeColorChange={updateThemeColor}
        themeColor={themeColor}
        themeColorOptions={themeColorOptions}
      />
    </div>
  );
}

export default SettingsPageContent;

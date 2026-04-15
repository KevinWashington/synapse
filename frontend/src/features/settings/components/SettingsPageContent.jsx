import ThemePreferenceCard from "./ThemePreferenceCard";
import useSettingsPage from "../hooks/useSettingsPage";

function SettingsPageContent() {
  const {
    themeColor,
    themeColorOptions,
    updateThemeColor,
  } = useSettingsPage();

  return (
    <div className="space-y-6">
      <ThemePreferenceCard
        onThemeColorChange={updateThemeColor}
        themeColor={themeColor}
        themeColorOptions={themeColorOptions}
      />
    </div>
  );
}

export default SettingsPageContent;

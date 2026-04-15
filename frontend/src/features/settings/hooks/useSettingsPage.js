import useThemePreference from "@hooks/useThemePreference";

function useSettingsPage() {
  const { themeColor, themeColorOptions, setThemeColor } = useThemePreference();

  return {
    themeColor,
    themeColorOptions,
    updateThemeColor: setThemeColor,
  };
}

export default useSettingsPage;

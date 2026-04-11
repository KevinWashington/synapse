import { SettingsPageContent } from "@features/settings";
import { usePageTitle } from "@hooks/usePageTitle";

function Settings() {
  usePageTitle({ title: "Configurações" });

  return <SettingsPageContent />;
}

export default Settings;


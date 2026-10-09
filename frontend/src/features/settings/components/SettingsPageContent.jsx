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
      <section aria-labelledby="configuracoes-ia" className="space-y-3">
        <div>
          <h2 id="configuracoes-ia" className="text-base font-semibold text-[var(--syn-text-primary)]">Inteligência artificial</h2>
          <p className="mt-1 text-sm text-muted-foreground">Configure os recursos de IA usados na sua conta.</p>
        </div>
        <DeepSeekKeyCard
          status={deepSeekStatus}
          loading={deepSeekLoading}
          saving={deepSeekSaving}
          error={deepSeekError}
          notice={deepSeekNotice}
          onSave={saveDeepSeekKey}
          onDelete={deleteDeepSeekKey}
        />
      </section>
      <section aria-labelledby="configuracoes-aparencia" className="space-y-3">
        <div>
          <h2 id="configuracoes-aparencia" className="text-base font-semibold text-[var(--syn-text-primary)]">Aparência</h2>
          <p className="mt-1 text-sm text-muted-foreground">Personalize a cor principal da interface.</p>
        </div>
        <ThemePreferenceCard
          onThemeColorChange={updateThemeColor}
          themeColor={themeColor}
          themeColorOptions={themeColorOptions}
        />
      </section>
    </div>
  );
}

export default SettingsPageContent;

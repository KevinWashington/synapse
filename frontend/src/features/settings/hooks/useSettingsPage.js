import { useCallback, useEffect, useState } from "react";
import useThemePreference from "@hooks/useThemePreference";
import { settingsService } from "../services/settingsService";

function useSettingsPage() {
  const { themeColor, themeColorOptions, setThemeColor } = useThemePreference();
  const [deepSeekStatus, setDeepSeekStatus] = useState({ configured: false });
  const [deepSeekLoading, setDeepSeekLoading] = useState(true);
  const [deepSeekSaving, setDeepSeekSaving] = useState(false);
  const [deepSeekError, setDeepSeekError] = useState(null);
  const [deepSeekNotice, setDeepSeekNotice] = useState(null);

  useEffect(() => {
    let active = true;
    settingsService.getDeepSeekKeyStatus()
      .then((status) => { if (active) setDeepSeekStatus(status); })
      .catch((error) => { if (active) setDeepSeekError(error.message || "Não foi possível carregar a configuração."); })
      .finally(() => { if (active) setDeepSeekLoading(false); });
    return () => { active = false; };
  }, []);

  const saveDeepSeekKey = useCallback(async (apiKey) => {
    setDeepSeekSaving(true);
    setDeepSeekError(null);
    setDeepSeekNotice(null);
    try {
      const status = await settingsService.saveDeepSeekKey(apiKey);
      setDeepSeekStatus(status);
      setDeepSeekNotice("Chave validada e salva com segurança.");
      return true;
    } catch (error) {
      setDeepSeekError(error.message || "Não foi possível validar a chave.");
      return false;
    } finally {
      setDeepSeekSaving(false);
    }
  }, []);

  const deleteDeepSeekKey = useCallback(async () => {
    setDeepSeekSaving(true);
    setDeepSeekError(null);
    setDeepSeekNotice(null);
    try {
      const status = await settingsService.deleteDeepSeekKey();
      setDeepSeekStatus(status);
      setDeepSeekNotice("Chave removida. Os demais recursos continuam disponíveis.");
      return true;
    } catch (error) {
      setDeepSeekError(error.message || "Não foi possível remover a chave.");
      return false;
    } finally {
      setDeepSeekSaving(false);
    }
  }, []);

  return {
    themeColor,
    themeColorOptions,
    updateThemeColor: setThemeColor,
    deepSeekStatus,
    deepSeekLoading,
    deepSeekSaving,
    deepSeekError,
    deepSeekNotice,
    saveDeepSeekKey,
    deleteDeepSeekKey,
  };
}

export default useSettingsPage;

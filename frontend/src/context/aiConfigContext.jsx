import { useState, useEffect } from "react";
import { AIConfigContext } from "./aiConfigContext.js";

export const AIConfigProvider = ({ children }) => {
  const [aiProvider, setAiProvider] = useState(() => {
    return localStorage.getItem("aiProvider") || "gemini";
  });

  const [ollamaConfig, setOllamaConfig] = useState(() => {
    const saved = localStorage.getItem("ollamaConfig");
    return saved
      ? JSON.parse(saved)
      : {
          url: "http://localhost:11434",
          model: "phi3",
        };
  });

  const [geminiConfig, setGeminiConfig] = useState(() => {
    const saved = localStorage.getItem("geminiConfig");
    return saved
      ? JSON.parse(saved)
      : {
          apiKey: "",
          model: "gemini-2.0-flash",
        };
  });

  // Salvar configurações no localStorage quando mudarem
  useEffect(() => {
    localStorage.setItem("aiProvider", aiProvider);
  }, [aiProvider]);

  useEffect(() => {
    localStorage.setItem("ollamaConfig", JSON.stringify(ollamaConfig));
  }, [ollamaConfig]);

  useEffect(() => {
    localStorage.setItem("geminiConfig", JSON.stringify(geminiConfig));
  }, [geminiConfig]);

  const updateAiProvider = (provider) => {
    setAiProvider(provider);
  };

  const updateOllamaConfig = (config) => {
    setOllamaConfig((prev) => ({ ...prev, ...config }));
  };

  const updateGeminiConfig = (config) => {
    setGeminiConfig((prev) => ({ ...prev, ...config }));
  };

  const getCurrentConfig = () => {
    return {
      provider: aiProvider,
      ollama: ollamaConfig,
      gemini: geminiConfig,
    };
  };

  const value = {
    aiProvider,
    ollamaConfig,
    geminiConfig,
    updateAiProvider,
    updateOllamaConfig,
    updateGeminiConfig,
    getCurrentConfig,
  };

  return (
    <AIConfigContext.Provider value={value}>
      {children}
    </AIConfigContext.Provider>
  );
};

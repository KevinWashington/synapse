import { createContext, useContext, useState, useEffect } from "react";

const AIConfigContext = createContext();

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

export const useAIConfig = () => {
  const context = useContext(AIConfigContext);
  if (!context) {
    throw new Error("useAIConfig must be used within an AIConfigProvider");
  }
  return context;
};

export { AIConfigContext };

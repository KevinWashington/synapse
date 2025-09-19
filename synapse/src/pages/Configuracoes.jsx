import { Button } from "@/components/ui/button";
import { useAIConfig } from "@/hooks/useAIConfig";
import { useState } from "react";

function Configuracoes() {
  const {
    aiProvider,
    ollamaConfig,
    geminiConfig,
    updateAiProvider,
    updateOllamaConfig,
    updateGeminiConfig,
  } = useAIConfig();

  const [showOllamaConfig, setShowOllamaConfig] = useState(false);
  const [showGeminiConfig, setShowGeminiConfig] = useState(false);

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains("dark");

    if (isDark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }
  };

  const isDark = document.documentElement.classList.contains("dark");
  return (
    <div>
      <h1 className="text-3xl font-bold text-foreground mb-3">Configurações</h1>

      <div className="space-y-6">
        <div className="bg-card rounded-lg shadow border p-6">
          <h2 className="text-xl font-semibold text-card-foreground mb-4">
            Preferências Gerais
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-foreground">
                  Tema Escuro
                </h3>
                <p className="text-sm text-muted-foreground">
                  Alternar para modo escuro
                </p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4 text-primary"
                checked={isDark}
                onChange={toggleTheme}
              />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg shadow border p-6">
          <h2 className="text-xl font-semibold text-card-foreground mb-4">
            Configurações de IA
          </h2>
          <div className="space-y-6">
            {/* Seleção do Provedor de IA */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3">
                Provedor de IA
              </h3>
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="aiProvider"
                    value="gemini"
                    checked={aiProvider === "gemini"}
                    onChange={(e) => updateAiProvider(e.target.value)}
                    className="h-4 w-4 text-primary"
                  />
                  <span className="text-sm text-foreground">Google Gemini</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="aiProvider"
                    value="ollama"
                    checked={aiProvider === "ollama"}
                    onChange={(e) => updateAiProvider(e.target.value)}
                    className="h-4 w-4 text-primary"
                  />
                  <span className="text-sm text-foreground">
                    Ollama (Local)
                  </span>
                </label>
              </div>
            </div>

            {/* Configurações do Gemini */}
            {aiProvider === "gemini" && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-foreground">
                    Configurações do Gemini
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowGeminiConfig(!showGeminiConfig)}
                  >
                    {showGeminiConfig ? "Ocultar" : "Configurar"}
                  </Button>
                </div>

                {showGeminiConfig && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        API Key
                      </label>
                      <input
                        type="password"
                        value={geminiConfig.apiKey}
                        onChange={(e) =>
                          updateGeminiConfig({ apiKey: e.target.value })
                        }
                        placeholder="Sua API Key do Gemini"
                        className="w-full px-3 py-2 border rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Modelo
                      </label>
                      <select
                        value={geminiConfig.model}
                        onChange={(e) =>
                          updateGeminiConfig({ model: e.target.value })
                        }
                        className="w-full px-3 py-2 border rounded-md text-sm"
                      >
                        <option value="gemini-2.0-flash">
                          Gemini 2.0 Flash
                        </option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                        <option value="gemini-1.5-flash">
                          Gemini 1.5 Flash
                        </option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Configurações do Ollama */}
            {aiProvider === "ollama" && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-foreground">
                    Configurações do Ollama
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowOllamaConfig(!showOllamaConfig)}
                  >
                    {showOllamaConfig ? "Ocultar" : "Configurar"}
                  </Button>
                </div>

                {showOllamaConfig && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        URL do Servidor
                      </label>
                      <input
                        type="text"
                        value={ollamaConfig.url}
                        onChange={(e) =>
                          updateOllamaConfig({ url: e.target.value })
                        }
                        placeholder="http://localhost:11434"
                        className="w-full px-3 py-2 border rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Modelo
                      </label>
                      <select
                        value={ollamaConfig.model}
                        onChange={(e) =>
                          updateOllamaConfig({ model: e.target.value })
                        }
                        className="w-full px-3 py-2 border rounded-md text-sm"
                      >
                        <option value="phi3">Phi-3</option>
                        <option value="llama2">Llama 2</option>
                        <option value="codellama">Code Llama</option>
                        <option value="mistral">Mistral</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Status do Provedor Atual */}
            <div className="text-sm text-muted-foreground">
              <strong>Provedor ativo:</strong>{" "}
              {aiProvider === "gemini" ? "Google Gemini" : "Ollama (Local)"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Configuracoes;

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import AIProviderOptionList from "./AIProviderOptionList";
import GeminiSettingsFields from "./GeminiSettingsFields";
import OllamaSettingsFields from "./OllamaSettingsFields";
import ProviderConfigPanel from "./ProviderConfigPanel";

function AIProviderSettingsCard({
  activeProviderLabel,
  aiProvider,
  geminiConfig,
  ollamaConfig,
  onAiProviderChange,
  onGeminiConfigChange,
  onOllamaConfigChange,
  onToggleGeminiConfig,
  onToggleOllamaConfig,
  showGeminiConfig,
  showOllamaConfig,
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurações de IA</CardTitle>
        <CardDescription>
          Escolha o provedor ativo e ajuste os parâmetros disponíveis.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <AIProviderOptionList
          aiProvider={aiProvider}
          onChange={onAiProviderChange}
        />

        {aiProvider === "gemini" ? (
          <ProviderConfigPanel
            title="Configurações do Gemini"
            isExpanded={showGeminiConfig}
            onToggle={onToggleGeminiConfig}
          >
            <GeminiSettingsFields
              geminiConfig={geminiConfig}
              onConfigChange={onGeminiConfigChange}
            />
          </ProviderConfigPanel>
        ) : null}

        {aiProvider === "ollama" ? (
          <ProviderConfigPanel
            title="Configurações do Ollama"
            isExpanded={showOllamaConfig}
            onToggle={onToggleOllamaConfig}
          >
            <OllamaSettingsFields
              ollamaConfig={ollamaConfig}
              onConfigChange={onOllamaConfigChange}
            />
          </ProviderConfigPanel>
        ) : null}

        <div className="text-sm text-muted-foreground">
          <strong>Provedor ativo:</strong> {activeProviderLabel}
        </div>
      </CardContent>
    </Card>
  );
}

export default AIProviderSettingsCard;

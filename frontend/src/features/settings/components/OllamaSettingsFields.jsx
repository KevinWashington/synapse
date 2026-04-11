import { Label } from "@/components/ui/Label";
import { OLLAMA_MODEL_OPTIONS, SETTINGS_FIELD_CLASS_NAME } from "../constants";

function OllamaSettingsFields({ ollamaConfig, onConfigChange }) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="ollama-url">URL do Servidor</Label>
        <input
          id="ollama-url"
          type="text"
          value={ollamaConfig.url}
          onChange={(event) => onConfigChange({ url: event.target.value })}
          placeholder="http://localhost:11434"
          className={SETTINGS_FIELD_CLASS_NAME}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="ollama-model">Modelo</Label>
        <select
          id="ollama-model"
          value={ollamaConfig.model}
          onChange={(event) => onConfigChange({ model: event.target.value })}
          className={SETTINGS_FIELD_CLASS_NAME}
        >
          {OLLAMA_MODEL_OPTIONS.map((modelOption) => (
            <option key={modelOption.value} value={modelOption.value}>
              {modelOption.label}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

export default OllamaSettingsFields;

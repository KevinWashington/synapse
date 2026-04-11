import { Label } from "@/components/ui/Label";
import { GEMINI_MODEL_OPTIONS, SETTINGS_FIELD_CLASS_NAME } from "../constants";

function GeminiSettingsFields({ geminiConfig, onConfigChange }) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="gemini-api-key">API Key</Label>
        <input
          id="gemini-api-key"
          type="password"
          value={geminiConfig.apiKey}
          onChange={(event) => onConfigChange({ apiKey: event.target.value })}
          placeholder="Sua API Key do Gemini"
          className={SETTINGS_FIELD_CLASS_NAME}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="gemini-model">Modelo</Label>
        <select
          id="gemini-model"
          value={geminiConfig.model}
          onChange={(event) => onConfigChange({ model: event.target.value })}
          className={SETTINGS_FIELD_CLASS_NAME}
        >
          {GEMINI_MODEL_OPTIONS.map((modelOption) => (
            <option key={modelOption.value} value={modelOption.value}>
              {modelOption.label}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

export default GeminiSettingsFields;

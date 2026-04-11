import { AI_PROVIDER_OPTIONS } from "../constants";

function AIProviderOptionList({ aiProvider, onChange }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-foreground">Provedor de IA</h3>

      <div className="space-y-2">
        {AI_PROVIDER_OPTIONS.map((provider) => (
          <label key={provider.value} className="flex items-center gap-2">
            <input
              type="radio"
              name="aiProvider"
              value={provider.value}
              checked={aiProvider === provider.value}
              onChange={(event) => onChange(event.target.value)}
              className="h-4 w-4 text-primary"
            />
            <span className="text-sm text-foreground">{provider.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default AIProviderOptionList;

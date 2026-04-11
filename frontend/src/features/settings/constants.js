export const AI_PROVIDER_OPTIONS = [
  {
    value: "gemini",
    label: "Google Gemini",
  },
  {
    value: "ollama",
    label: "Ollama (Local)",
  },
];

export const GEMINI_MODEL_OPTIONS = [
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
  { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
];

export const OLLAMA_MODEL_OPTIONS = [
  { value: "phi3", label: "Phi-3" },
  { value: "llama2", label: "Llama 2" },
  { value: "codellama", label: "Code Llama" },
  { value: "mistral", label: "Mistral" },
];

export const SETTINGS_FIELD_CLASS_NAME =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

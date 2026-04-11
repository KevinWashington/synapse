import { useState, useRef, useEffect, useCallback } from "react";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/utils";
import { Check, Loader2 } from "lucide-react";

function NotesEditor({ valorInicial = "", onSalvar }) {
  const [texto, setTexto] = useState(valorInicial || "");
  const [linhas, setLinhas] = useState([1]);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved
  const textareaRef = useRef(null);
  const linhasRef = useRef(null);
  const debounceRef = useRef(null);
  const lastSavedRef = useRef(valorInicial || "");

  useEffect(() => {
    setTexto(valorInicial || "");
    lastSavedRef.current = valorInicial || "";
  }, [valorInicial]);

  useEffect(() => {
    const numeroLinhas = texto.split("\n").length;
    setLinhas(
      Array.from({ length: Math.max(numeroLinhas, 10) }, (_, i) => i + 1)
    );
  }, [texto]);

  // Debounced auto-save
  const saveNotas = useCallback(
    async (value) => {
      if (!onSalvar || value === lastSavedRef.current) return;

      setSaveStatus("saving");
      try {
        await onSalvar(value);
        lastSavedRef.current = value;
        setSaveStatus("saved");
        // Reset status after 2 seconds
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("idle");
      }
    },
    [onSalvar]
  );

  const handleChange = (e) => {
    const newValue = e.target.value;
    setTexto(newValue);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set new debounce (1.5s)
    debounceRef.current = setTimeout(() => {
      saveNotas(newValue);
    }, 1500);
  };

  // Cleanup debounce on unmount + save pending changes
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleScroll = (e) => {
    if (linhasRef.current) {
      linhasRef.current.scrollTop = e.target.scrollTop;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Editor */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        <div
          ref={linhasRef}
          className="w-12 overflow-hidden border-r border-[var(--syn-border)] bg-[var(--syn-bg-secondary)] py-2 select-none"
        >
          {linhas.map((num) => (
            <div key={num} className="text-[var(--syn-text-secondary)] text-right px-2 h-6 text-xs font-mono">
              {num}
            </div>
          ))}
        </div>

        <Textarea
          ref={textareaRef}
          value={texto}
          onChange={handleChange}
          onScroll={handleScroll}
          placeholder="Digite suas notas aqui..."
          className={cn(
            "flex-1 resize-none border-none rounded-none p-3",
            "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-none",
            "h-full font-mono text-sm leading-6 text-[var(--syn-text-primary)] placeholder:text-[var(--syn-text-secondary)]"
          )}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-[var(--syn-text-secondary)] px-4 py-2 border-t border-[var(--syn-border)]">
        <span>Caracteres: {texto.length} · Linhas: {texto.split("\n").length}</span>
        <div className="flex items-center gap-1.5">
          {saveStatus === "saving" && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Salvando...</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <Check className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-500">Salvo</span>
            </>
          )}
          {saveStatus === "idle" && (
            <span>Salvamento automático</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default NotesEditor;



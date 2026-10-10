import { forwardRef, useState, useRef, useEffect, useCallback, useImperativeHandle } from "react";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Check, Loader2 } from "lucide-react";

const NotesEditor = forwardRef(function NotesEditor({ valorInicial = "", onSalvar, readOnly = false }, ref) {
  const [texto, setTexto] = useState(valorInicial || "");
  const [saveStatus, setSaveStatus] = useState("idle");
  const textRef = useRef(valorInicial || "");
  const lastSavedRef = useRef(valorInicial || "");
  const debounceRef = useRef(null);
  const inFlightRef = useRef(null);
  const mountedRef = useRef(true);
  const configRef = useRef({ onSalvar, readOnly });

  useEffect(() => { configRef.current = { onSalvar, readOnly }; }, [onSalvar, readOnly]);

  useEffect(() => {
    // An acknowledgement of an earlier save must not replace newer typing.
    if (textRef.current === lastSavedRef.current && !inFlightRef.current) {
      textRef.current = valorInicial || "";
      lastSavedRef.current = valorInicial || "";
      setTexto(valorInicial || "");
    }
  }, [valorInicial]);

  const flush = useCallback(() => {
    clearTimeout(debounceRef.current);
    if (inFlightRef.current) return inFlightRef.current;
    if (configRef.current.readOnly || !configRef.current.onSalvar) return Promise.resolve(false);
    if (textRef.current === lastSavedRef.current) return Promise.resolve(true);

    const save = async () => {
      if (mountedRef.current) setSaveStatus("saving");
      try {
        // Serialize writes so a slow request cannot overwrite a newer save.
        while (textRef.current !== lastSavedRef.current && !configRef.current.readOnly) {
          const value = textRef.current;
          await configRef.current.onSalvar(value);
          lastSavedRef.current = value;
        }
        if (mountedRef.current) setSaveStatus(textRef.current === lastSavedRef.current ? "saved" : "pending");
        return textRef.current === lastSavedRef.current;
      } catch {
        if (mountedRef.current) setSaveStatus("error");
        return false;
      } finally {
        inFlightRef.current = null;
      }
    };
    inFlightRef.current = save();
    return inFlightRef.current;
  }, []);

  const updateText = useCallback((value) => {
    if (configRef.current.readOnly) return;
    textRef.current = value;
    setTexto(value);
    setSaveStatus("pending");
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(flush, 1500);
  }, [flush]);

  useImperativeHandle(ref, () => ({
    append: (content) => {
      if (configRef.current.readOnly) return Promise.resolve(false);
      updateText(textRef.current ? `${textRef.current}\n\n${content}` : content);
      return flush();
    },
  }), [flush, updateText]);

  useEffect(() => {
    mountedRef.current = true;
    const beforeUnload = (event) => {
      if (textRef.current !== lastSavedRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("beforeunload", beforeUnload);
      void flush();
    };
  }, [flush]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Textarea
        aria-label="Notas do artigo"
        value={texto}
        readOnly={readOnly}
        onChange={(event) => updateText(event.target.value)}
        onBlur={() => { void flush(); }}
        placeholder="Digite suas notas aqui..."
        className="min-h-0 flex-1 resize-none rounded-none border-none p-4 text-sm leading-7 shadow-none focus-visible:ring-0 text-[var(--syn-text-primary)]"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--syn-border)] px-4 py-3 text-xs text-[var(--syn-text-secondary)]">
        <span>{texto.length} caracteres</span>
        {saveStatus === "error" ? (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-[var(--syn-badge-high-text)]">
            <span>Não foi possível salvar. Seu texto permanece aqui.</span>
            <Button size="sm" variant="outline" disabled={readOnly} onClick={() => { void flush(); }}>Tentar novamente</Button>
          </div>
        ) : (
          <span role="status" className="flex items-center gap-1.5">
            {saveStatus === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {saveStatus === "saved" ? <Check className="h-3 w-3 text-emerald-600" /> : null}
            {readOnly ? "Somente leitura" : {
              idle: "Salvamento automático", pending: "Alterações pendentes", saving: "Salvando...", saved: "Salvo",
            }[saveStatus]}
          </span>
        )}
      </div>
    </div>
  );
});

export default NotesEditor;

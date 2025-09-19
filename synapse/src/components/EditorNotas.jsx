import { useState, useRef, useEffect } from "react";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { cn } from "@/lib/utils";

function EditorNotas({ valorInicial = "", onSalvar }) {
  const [texto, setTexto] = useState(valorInicial);
  const [linhas, setLinhas] = useState([1]);
  const textareaRef = useRef(null);
  const linhasRef = useRef(null);

  useEffect(() => {
    setTexto(valorInicial);
  }, [valorInicial]);

  useEffect(() => {
    const numeroLinhas = texto.split("\n").length;
    setLinhas(
      Array.from({ length: Math.max(numeroLinhas, 10) }, (_, i) => i + 1)
    );
  }, [texto]);

  const handleScroll = (e) => {
    if (linhasRef.current) {
      linhasRef.current.scrollTop = e.target.scrollTop;
    }
  };

  const handleSalvar = () => {
    if (onSalvar) onSalvar(texto);
  };

  return (
    <div className="flex flex-col h-full p-4 border">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold ">Notas</h2>
        <Button onClick={handleSalvar} variant="default">
          Salvar
        </Button>
      </div>

      <Separator className="mb-4" />

      <div className="flex flex-1 bg-white rounded-md border overflow-hidden shadow-inner min-h-0">
        <div
          ref={linhasRef}
          className="border-r py-2 overflow-hidden select-none"
          style={{
            width: "3rem",
            overflowY: "hidden",
          }}
        >
          {linhas.map((num) => (
            <div
              key={num}
              className="text-amber-800/70 text-right px-2 h-6 text-sm font-mono"
            >
              {num}
            </div>
          ))}
        </div>

        <Textarea
          ref={textareaRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onScroll={handleScroll}
          placeholder="Digite suas notas aqui..."
          className={cn(
            "flex-1 resize-none border-none rounded-none p-2",
            "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-none",
            "font-mono text-sm h-full"
          )}
          style={{
            background:
              "linear-gradient(transparent 0%, transparent calc(1.5rem - 1px), #e5e7eb calc(1.5rem), transparent calc(1.5rem + 1px))",
            backgroundSize: "100% 1.5rem",
            lineHeight: "1.5rem",
          }}
        />
      </div>

      <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
        <span>Caracteres: {texto.length}</span>
        <span>Linhas: {texto.split("\n").length}</span>
      </div>
    </div>
  );
}

export default EditorNotas;

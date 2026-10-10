import { useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function PlanningSectionSearch({ onOpenChange, onSectionSelect, open, sections }) {
  const [query, setQuery] = useState("");
  const filteredSections = useMemo(() => {
    const normalizedQuery = normalize(query.trim());
    if (!normalizedQuery) return sections;
    return sections.filter((section) => normalize([
      section.label,
      section.description,
      ...(section.keywords || []),
    ].join(" ")).includes(normalizedQuery));
  }, [query, sections]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Buscar seção</DialogTitle>
          <DialogDescription>Encontre rapidamente qualquer parte do planejamento.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8993aa]" />
          <Input
            aria-label="Buscar seção"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Digite uma seção ou assunto..."
            className="pl-9"
          />
        </div>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {filteredSections.map((section) => (
            <button
              key={section.key}
              type="button"
              onClick={() => {
                onSectionSelect(section.key);
                onOpenChange(false);
              }}
              className="flex w-full min-w-0 items-center justify-between gap-4 rounded-lg border border-[#e2e6ef] px-4 py-3 text-left hover:border-[#c9c3ff] hover:bg-[#fbfaff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6259ff]"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[#111936]">{section.label}</span>
                <span className="mt-0.5 block text-xs text-[#667391]">{section.description}</span>
              </span>
              <span className="shrink-0 text-xs font-medium text-[#667391]">{section.summary}</span>
            </button>
          ))}
          {!filteredSections.length ? (
            <p className="rounded-lg border border-dashed border-[#dfe4ef] px-4 py-8 text-center text-sm text-[#667391]">Nenhuma seção encontrada.</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PlanningSectionSearch;

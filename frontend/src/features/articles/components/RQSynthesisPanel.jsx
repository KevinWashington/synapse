import { useState } from "react";
import { DownloadIcon, LoaderIcon, RefreshCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";

function triggerFileDownload(content, contentType, fileName) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function toMatrixCsv(data) {
  const rows = data?.matrix || [];
  const header = ["articleId", "paperId", "title", "year", "decision", "rqs"];
  const lines = [header.join(",")];

  rows.forEach((row) => {
    const values = [
      row.articleId,
      row.paperId || "",
      row.title || "",
      row.year || "",
      row.decision || "",
      (row.rqs || []).join("|"),
    ].map((value) => {
      const safe = String(value).replace(/"/g, '""');
      return `"${safe}"`;
    });
    lines.push(values.join(","));
  });

  return lines.join("\n");
}

function RQCard({ active, entry, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-md border px-3 py-2 text-left transition-colors ${
        active
          ? "border-[var(--syn-sidebar-accent)] bg-[var(--syn-bg-tertiary)]"
          : "border-[var(--syn-border)] bg-[var(--syn-bg-secondary)] hover:bg-[var(--syn-bg-tertiary)]"
      }`}
    >
      <p className="text-xs font-semibold text-[var(--syn-text-primary)]">RQ {entry.rqNumber}</p>
      <p className="mt-0.5 line-clamp-2 text-xs text-[var(--syn-text-secondary)]" title={entry.question}>
        {entry.question}
      </p>
      <p className="mt-2 text-[11px] text-[var(--syn-text-secondary)]">
        Evidências: {entry.evidenceCount}
      </p>
    </button>
  );
}

function RQSynthesisPanel({
  data,
  isLoading,
  onRefresh,
  onOpenArticle,
}) {
  const [selectedRQ, setSelectedRQ] = useState(null);

  const matrixRows = data?.matrix || [];
  const rqEntries = data?.rqSynthesis || [];

  const selectedEntry = !selectedRQ
    ? null
    : rqEntries.find((entry) => entry.rqNumber === selectedRQ) || null;

  const filteredMatrix = !selectedRQ
    ? matrixRows
    : matrixRows.filter((row) => (row.rqs || []).includes(selectedRQ));

  function handleExportJson() {
    if (!data) {
      return;
    }

    triggerFileDownload(
      JSON.stringify(data, null, 2),
      "application/json;charset=utf-8",
      `rq-synthesis-project-${data.projectId}.json`
    );
  }

  function handleExportCsv() {
    if (!data) {
      return;
    }

    triggerFileDownload(
      toMatrixCsv(data),
      "text/csv;charset=utf-8",
      `rq-synthesis-matrix-project-${data.projectId}.csv`
    );
  }

  return (
    <div className="space-y-3 rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md bg-[var(--syn-bg-secondary)] px-2 py-1 text-[var(--syn-text-secondary)]">
            RQs: {data?.rqCount || 0}
          </span>
          <span className="rounded-md bg-[var(--syn-bg-secondary)] px-2 py-1 text-[var(--syn-text-secondary)]">
            RQs cobertas: {data?.coverage?.answeredRQCount || 0}
          </span>
          <span className="rounded-md bg-[var(--syn-bg-secondary)] px-2 py-1 text-[var(--syn-text-secondary)]">
            Cobertura: {data?.coverage?.answeredRQPercentage || 0}%
          </span>
          <span className="rounded-md bg-[var(--syn-bg-secondary)] px-2 py-1 text-[var(--syn-text-secondary)]">
            Incluídos sem vínculo: {data?.coverage?.includedWithoutRQLinks || 0}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={onRefresh}
            disabled={isLoading}
          >
            {isLoading ? (
              <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCcwIcon className="h-3.5 w-3.5" />
            )}
            Atualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={handleExportJson}
            disabled={!data}
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={handleExportCsv}
            disabled={!data}
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 rounded-md bg-[var(--syn-bg-secondary)] px-3 py-2 text-xs text-[var(--syn-text-secondary)]">
          <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
          Carregando síntese por RQ...
        </div>
      ) : null}

      {!isLoading ? (
        <>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {rqEntries.map((entry) => (
              <RQCard
                key={entry.rqNumber}
                entry={entry}
                active={selectedRQ === entry.rqNumber}
                onSelect={() =>
                  setSelectedRQ((current) =>
                    current === entry.rqNumber ? null : entry.rqNumber
                  )
                }
              />
            ))}
          </div>

          {selectedEntry ? (
            <div className="space-y-2 rounded-md border border-[var(--syn-border)] bg-[var(--syn-bg-secondary)] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[var(--syn-text-primary)]">
                  Evidências de RQ {selectedEntry.rqNumber}
                </p>
                <span className="text-[11px] text-[var(--syn-text-secondary)]">
                  {selectedEntry.evidenceCount} evidências
                </span>
              </div>

              {selectedEntry.articles?.length ? (
                <div className="space-y-1.5">
                  {selectedEntry.articles.map((article) => (
                    <div
                      key={article.id}
                      className="flex items-start justify-between gap-3 rounded border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] px-2 py-1.5"
                    >
                      <div className="min-w-0">
                        <button
                          type="button"
                          className="truncate text-left text-xs font-medium text-[var(--syn-text-primary)] hover:underline"
                          onClick={() => onOpenArticle(article.id)}
                          title={article.title}
                        >
                          {article.title}
                        </button>
                        {article.evidenceExcerpt ? (
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--syn-text-secondary)]" title={article.evidenceExcerpt}>
                            {article.evidenceExcerpt}
                          </p>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-[11px] text-[var(--syn-text-secondary)]">
                        {article.year || "-"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--syn-text-secondary)]">
                  Nenhuma evidência vinculada para esta pergunta.
                </p>
              )}
            </div>
          ) : null}

          <div className="rounded-md border border-[var(--syn-border)]">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--syn-border)] px-3 py-2">
              <p className="text-xs font-semibold text-[var(--syn-text-primary)]">Matriz Artigo x RQ</p>
              <span className="text-[11px] text-[var(--syn-text-secondary)]">
                {filteredMatrix.length} artigos
              </span>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[42%]">Artigo</TableHead>
                  <TableHead className="w-[10%]">Ano</TableHead>
                  <TableHead className="w-[16%]">Decisão</TableHead>
                  <TableHead>RQs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMatrix.length ? (
                  filteredMatrix.map((row) => (
                    <TableRow key={row.articleId}>
                      <TableCell className="max-w-[420px]">
                        <button
                          type="button"
                          className="block truncate text-left text-xs font-medium text-[var(--syn-text-primary)] hover:underline"
                          onClick={() => onOpenArticle(row.articleId)}
                          title={row.title}
                        >
                          {row.title}
                        </button>
                      </TableCell>
                      <TableCell className="text-xs text-[var(--syn-text-secondary)]">
                        {row.year || "-"}
                      </TableCell>
                      <TableCell>
                        <span className="rounded-md bg-[var(--syn-bg-secondary)] px-2 py-1 text-[11px] text-[var(--syn-text-secondary)]">
                          {row.decision || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(row.rqs || []).length ? (
                            row.rqs.map((rqNumber) => (
                              <span
                                key={`${row.articleId}-${rqNumber}`}
                                className="rounded bg-[var(--syn-bg-secondary)] px-1.5 py-0.5 text-[11px] text-[var(--syn-text-secondary)]"
                              >
                                RQ {rqNumber}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-[var(--syn-text-secondary)]">
                              Sem vínculo
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="py-4 text-center text-xs text-[var(--syn-text-secondary)]">
                      Nenhum artigo disponível para o filtro atual.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {(data?.unlinkedIncludedArticles || []).length ? (
            <div className="rounded-md border border-[var(--syn-border)] bg-[var(--syn-bg-secondary)] p-3">
              <p className="text-xs font-semibold text-[var(--syn-text-primary)]">
                Incluídos sem vínculo com RQ
              </p>
              <div className="mt-2 space-y-1.5">
                {data.unlinkedIncludedArticles.slice(0, 8).map((article) => (
                  <div key={article.id} className="flex items-center justify-between gap-3 text-xs">
                    <button
                      type="button"
                      className="truncate text-left text-[var(--syn-text-primary)] hover:underline"
                      onClick={() => onOpenArticle(article.id)}
                      title={article.title}
                    >
                      {article.title}
                    </button>
                    <span className="shrink-0 text-[var(--syn-text-secondary)]">
                      {article.year || "-"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default RQSynthesisPanel;

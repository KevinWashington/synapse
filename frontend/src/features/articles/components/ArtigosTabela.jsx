import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  SearchIcon,
  FilterIcon,
  FileTextIcon,
  LoaderIcon,
  MoreVerticalIcon,
  EditIcon,
  TrashIcon,
  EyeIcon,
  FileIcon,
  CheckIcon,
  ClockIcon,
  XIcon,
  Sparkles,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowUpDownIcon,
} from "lucide-react";

function ArtigosTabela({
  artigos,
  loadingArtigos,
  searchTerm,
  setSearchTerm,
  filterStatus,
  setFilterStatus,
  statusList,
  handleAtualizarStatusArtigo,
  handleDeletarArtigo,
  handleRevisarArtigo,
  handleEditarArtigo,
  handleImportarBibTeX,
  handleAdicionarArtigo,
}) {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");

  const handleSort = (column) => {
    if (sortColumn === column) {
      if (sortDirection === "asc") setSortDirection("desc");
      else { setSortColumn(null); setSortDirection("asc"); }
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }) => {
    if (sortColumn !== column) return <ArrowUpDownIcon className="h-3 w-3 ml-1 opacity-40" />;
    return sortDirection === "asc"
      ? <ArrowUpIcon className="h-3 w-3 ml-1" />
      : <ArrowDownIcon className="h-3 w-3 ml-1" />;
  };

  const sortedArtigos = useMemo(() => {
    if (!sortColumn) return artigos;
    return [...artigos].sort((a, b) => {
      let valA, valB;
      switch (sortColumn) {
        case "title": valA = (a.title || "").toLowerCase(); valB = (b.title || "").toLowerCase(); break;
        case "authors": valA = (a.authors || "").toLowerCase(); valB = (b.authors || "").toLowerCase(); break;
        case "year": valA = a.year || 0; valB = b.year || 0; break;
        case "journal": valA = (a.journal || "").toLowerCase(); valB = (b.journal || "").toLowerCase(); break;
        case "status": valA = a.status || ""; valB = b.status || ""; break;
        case "aiRelevanceScore": valA = a.aiRelevanceScore ?? -1; valB = b.aiRelevanceScore ?? -1; break;
        default: return 0;
      }
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [artigos, sortColumn, sortDirection]);

  return (
    <div className="space-y-4">
      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--syn-text-secondary)] h-4 w-4" />
          <Input
            type="text"
            placeholder="Pesquisar artigos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <FilterIcon className="h-4 w-4 text-[var(--syn-text-secondary)]" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Filtrar por..." />
            </SelectTrigger>
            <SelectContent>
              {statusList.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loading */}
      {loadingArtigos && (
        <div className="flex justify-center items-center py-8">
          <LoaderIcon className="h-5 w-5 animate-spin text-[var(--syn-text-secondary)]" />
          <span className="ml-2 text-sm text-[var(--syn-text-secondary)]">Carregando artigos...</span>
        </div>
      )}

      {/* Table */}
      {!loadingArtigos && artigos.length > 0 && (
        <>
          <div className="rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="w-[300px] min-w-[250px] cursor-pointer select-none hover:bg-[var(--syn-bg-secondary)] transition-colors"
                    onClick={() => handleSort("title")}
                  >
                    <span className="flex items-center">Título <SortIcon column="title" /></span>
                  </TableHead>
                  <TableHead
                    className="w-[200px] min-w-[150px] cursor-pointer select-none hover:bg-[var(--syn-bg-secondary)] transition-colors"
                    onClick={() => handleSort("authors")}
                  >
                    <span className="flex items-center">Autores <SortIcon column="authors" /></span>
                  </TableHead>
                  <TableHead
                    className="w-[80px] cursor-pointer select-none hover:bg-[var(--syn-bg-secondary)] transition-colors"
                    onClick={() => handleSort("year")}
                  >
                    <span className="flex items-center">Ano <SortIcon column="year" /></span>
                  </TableHead>
                  <TableHead
                    className="w-[200px] min-w-[150px] cursor-pointer select-none hover:bg-[var(--syn-bg-secondary)] transition-colors"
                    onClick={() => handleSort("journal")}
                  >
                    <span className="flex items-center">Revista/Conferência <SortIcon column="journal" /></span>
                  </TableHead>
                  <TableHead
                    className="w-[120px] cursor-pointer select-none hover:bg-[var(--syn-bg-secondary)] transition-colors"
                    onClick={() => handleSort("status")}
                  >
                    <span className="flex items-center">Status <SortIcon column="status" /></span>
                  </TableHead>
                  <TableHead
                    className="w-[100px] cursor-pointer select-none hover:bg-[var(--syn-bg-secondary)] transition-colors"
                    onClick={() => handleSort("aiRelevanceScore")}
                  >
                    <span className="flex items-center">Relevância IA <SortIcon column="aiRelevanceScore" /></span>
                  </TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedArtigos.map((artigo) => (
                  <TableRow key={artigo.id}>
                    <TableCell className="font-medium max-w-[300px]">
                      <div className="flex items-center gap-2">
                        <FileIcon
                          className={`h-4 w-4 flex-shrink-0 ${artigo.hasPdf
                            ? "text-blue-500"
                            : "text-[var(--syn-text-secondary)]"
                            }`}
                        />
                        <div className="flex-1 min-w-0">
                          <span
                            className="line-clamp-2 block"
                            title={artigo.title}
                          >
                            {artigo.title}
                          </span>
                        </div>
                        {!artigo.hasPdf && (
                          <span className="text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded-full flex-shrink-0">
                            Sem PDF
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <span
                        className="line-clamp-1 block truncate"
                        title={artigo.authors}
                      >
                        {artigo.authors}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">{artigo.year}</TableCell>
                    <TableCell className="max-w-[200px]">
                      <span
                        className="line-clamp-1 block truncate"
                        title={artigo.journal}
                      >
                        {artigo.journal}
                      </span>
                    </TableCell>
                    <TableCell><StatusBadge status={artigo.status} /></TableCell>
                    <TableCell>
                      {artigo.aiRelevanceScore !== undefined && artigo.aiRelevanceScore !== null ? (
                        <div
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border transition-colors cursor-help ${artigo.aiSuggestedStatus === "incluido"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-red-50 text-red-700 border-red-200"
                            }`}
                          title={`Sugestão: ${artigo.aiSuggestedStatus === "incluido" ? "Incluir" : "Excluir"}\n${artigo.aiEvaluation}`}
                        >
                          <Sparkles className="h-3 w-3" />
                          {artigo.aiRelevanceScore}%
                        </div>
                      ) : (
                        <span className="text-[var(--syn-text-secondary)] text-xs italic">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreVerticalIcon className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleRevisarArtigo(artigo)}
                          >
                            <EyeIcon className="mr-2 h-4 w-4" />
                            Revisar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleEditarArtigo(artigo)}
                          >
                            <EditIcon className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>

                          {/* Submenu de Status */}
                          <DropdownMenuItem>
                            <span className="mr-2">Status:</span>
                          </DropdownMenuItem>
                          {artigo.status !== "analisado" && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleAtualizarStatusArtigo(artigo, "analisado")
                              }
                            >
                              <CheckIcon className="mr-2 h-4 w-4 text-green-600" />
                              Marcar como analisado
                            </DropdownMenuItem>
                          )}
                          {artigo.status !== "pendente" && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleAtualizarStatusArtigo(artigo, "pendente")
                              }
                            >
                              <ClockIcon className="mr-2 h-4 w-4 text-amber-600" />
                              Marcar como pendente
                            </DropdownMenuItem>
                          )}
                          {artigo.status !== "excluido" && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleAtualizarStatusArtigo(artigo, "excluido")
                              }
                            >
                              <XIcon className="mr-2 h-4 w-4 text-red-600" />
                              Marcar como excluído
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuItem
                            onClick={() => handleDeletarArtigo(artigo)}
                            className="text-red-600"
                          >
                            <TrashIcon className="mr-2 h-4 w-4" />
                            Deletar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Empty state */}
      {!loadingArtigos && artigos.length === 0 && (
        <div className="text-center py-12">
          <FileTextIcon className="h-12 w-12 text-[var(--syn-text-secondary)] mx-auto mb-3" />
          <h3 className="text-sm font-medium text-[var(--syn-text-primary)] mb-1">
            Nenhum artigo encontrado
          </h3>
          <p className="text-xs text-[var(--syn-text-secondary)]">
            {searchTerm || filterStatus !== "todos"
              ? "Tente ajustar os filtros de pesquisa"
              : "Adicione artigos usando os botões acima"}
          </p>
        </div>
      )}
    </div>
  );
}

export default ArtigosTabela;

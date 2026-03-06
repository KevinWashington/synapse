import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ArtigoCard from "./ArtigoCard";
import ArtigosTabela from "./ArtigosTabela";
import NovoArtigoModal from "./NovoArtigoModal";
import ImportarBibTeXModal from "./ImportarBibTeXModal";
import EditarArtigoModal from "./EditarArtigoModal";
import UploadPDFModal from "./UploadPDFModal";
import {
  PlusIcon,
  SearchIcon,
  FilterIcon,
  FileTextIcon,
  LoaderIcon,
  TableIcon,
  GridIcon,
  UploadIcon,
} from "lucide-react";
import { useArtigos } from "../hooks/useArtigos";

function ArtigosProjeto({ projeto, onNavigate }) {
  const [viewMode, setViewMode] = useState("tabela"); // "tabela" ou "cards"
  const [showNovoArtigoModal, setShowNovoArtigoModal] = useState(false);
  const [showImportarModal, setShowImportarModal] = useState(false);
  const [showEditarModal, setShowEditarModal] = useState(false);
  const [showUploadPDFModal, setShowUploadPDFModal] = useState(false);
  const [artigoParaEditar, setArtigoParaEditar] = useState(null);
  const [artigoParaUploadPDF, setArtigoParaUploadPDF] = useState(null);

  const {
    loadingArtigos,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    artigos,
    pagination,
    handleAtualizarStatusArtigo,
    handleDeletarArtigo,
    handleNovoArtigoSuccess,
    handleImportarSuccess,
    handleEditarSuccess,
    handleUploadPDFSuccess,
    statusList,
  } = useArtigos(projeto);

  const handleAdicionarArtigo = () => {
    setShowNovoArtigoModal(true);
  };

  const handleImportarBibTeX = () => {
    setShowImportarModal(true);
  };

  const handleEditarArtigo = (artigo) => {
    setArtigoParaEditar(artigo);
    setShowEditarModal(true);
  };

  const handleRevisarArtigo = (artigo) => {
    // Navegar para detalhes do artigo (PDF é opcional agora)
    onNavigate(`/projetos/${projeto.id}/artigos/${artigo.id}`);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar: view toggle + actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-[var(--syn-border)] p-0.5">
            <button
              onClick={() => setViewMode("tabela")}
              className={`flex items-center justify-center h-7 w-7 rounded-md transition-colors ${
                viewMode === "tabela"
                  ? "bg-[var(--syn-sidebar-bg)] text-white"
                  : "text-[var(--syn-text-secondary)] hover:bg-[var(--syn-bg-secondary)]"
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`flex items-center justify-center h-7 w-7 rounded-md transition-colors ${
                viewMode === "cards"
                  ? "bg-[var(--syn-sidebar-bg)] text-white"
                  : "text-[var(--syn-text-secondary)] hover:bg-[var(--syn-bg-secondary)]"
              }`}
            >
              <GridIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          {pagination.totalDocuments > 0 && (
            <span className="text-xs text-[var(--syn-text-secondary)]">
              {pagination.totalDocuments} {pagination.totalDocuments === 1 ? "artigo" : "artigos"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={handleImportarBibTeX}>
            <UploadIcon className="h-3.5 w-3.5" />
            Importar BibTeX
          </Button>
          <Button size="sm" className="gap-2 text-xs" onClick={handleAdicionarArtigo}>
            <PlusIcon className="h-3.5 w-3.5" />
            Adicionar Artigo
          </Button>
        </div>
      </div>

      {/* Renderizar visualização baseada no modo selecionado */}
      {viewMode === "tabela" ? (
        <ArtigosTabela
          projeto={projeto}
          onNavigate={onNavigate}
          artigos={artigos}
          loadingArtigos={loadingArtigos}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          statusList={statusList}
          handleAtualizarStatusArtigo={handleAtualizarStatusArtigo}
          handleDeletarArtigo={handleDeletarArtigo}
          handleRevisarArtigo={handleRevisarArtigo}
          handleEditarArtigo={handleEditarArtigo}
          handleImportarBibTeX={handleImportarBibTeX}
          handleAdicionarArtigo={handleAdicionarArtigo}
        />
      ) : (
        <>
          {/* Search + filter for cards mode */}
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

          {/* Card grid */}
          {!loadingArtigos && artigos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4">
              {artigos.map((artigo) => (
                <ArtigoCard
                  key={artigo.id}
                  artigo={artigo}
                  onClick={() => handleRevisarArtigo(artigo)}
                  onChangeStatus={(status) =>
                    handleAtualizarStatusArtigo(artigo, status)
                  }
                  onDelete={() => handleDeletarArtigo(artigo)}
                  onEdit={() => handleEditarArtigo(artigo)}
                  onUploadPDF={() => {
                    setArtigoParaUploadPDF(artigo);
                    setShowUploadPDFModal(true);
                  }}
                />
              ))}
            </div>
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
        </>
      )}

      {/* Modal para adicionar artigo */}
      <NovoArtigoModal
        isOpen={showNovoArtigoModal}
        onClose={() => setShowNovoArtigoModal(false)}
        onSuccess={handleNovoArtigoSuccess}
        projectId={projeto.id}
      />

      {/* Modal para importar BibTeX */}
      <ImportarBibTeXModal
        isOpen={showImportarModal}
        onClose={() => setShowImportarModal(false)}
        onSuccess={handleImportarSuccess}
        projectId={projeto.id}
      />

      {/* Modal para editar artigo */}
      <EditarArtigoModal
        isOpen={showEditarModal}
        onClose={() => {
          setShowEditarModal(false);
          setArtigoParaEditar(null);
        }}
        onSuccess={handleEditarSuccess}
        projeto={projeto}
        artigo={artigoParaEditar}
      />

      {/* Modal para upload de PDF */}
      <UploadPDFModal
        isOpen={showUploadPDFModal}
        onClose={() => {
          setShowUploadPDFModal(false);
          setArtigoParaUploadPDF(null);
        }}
        onSuccess={handleUploadPDFSuccess}
        projeto={projeto}
        artigo={artigoParaUploadPDF}
      />
    </div>
  );
}

export default ArtigosProjeto;

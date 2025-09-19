import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
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
import { useArtigos } from "../hooks/useArtigos.js";

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
    if (!artigo.pdfFile) {
      setArtigoParaUploadPDF(artigo);
      setShowUploadPDFModal(true);
    } else {
      // Se tem PDF, navegar para detalhes
      onNavigate(`/projetos/${projeto._id}/artigos/${artigo._id}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho com seletor de visualização */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            Artigos do Projeto
            {pagination.totalDocuments > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({pagination.totalDocuments}{" "}
                {pagination.totalDocuments === 1 ? "artigo" : "artigos"})
              </span>
            )}
          </h2>
        </div>

        {/* Seletor de visualização */}
        <div className="flex items-center gap-1 border rounded-lg p-1">
          <Button
            variant={viewMode === "tabela" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("tabela")}
            className="h-8 px-3"
          >
            <TableIcon className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "cards" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("cards")}
            className="h-8 px-3"
          >
            <GridIcon className="h-4 w-4" />
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
          {/* Barra de pesquisa e filtros para visualização em cards */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="Pesquisar artigos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <FilterIcon className="h-4 w-4 text-muted-foreground" />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
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
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={handleImportarBibTeX}
              >
                <UploadIcon className="h-4 w-4" />
                Importar BibTeX
              </Button>
              <Button
                className="flex items-center gap-2"
                onClick={handleAdicionarArtigo}
              >
                <PlusIcon className="h-4 w-4" />
                Adicionar Artigo
              </Button>
            </div>
          </div>

          {/* Loading para artigos */}
          {loadingArtigos && (
            <div className="flex justify-center items-center py-8">
              <LoaderIcon className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2">Carregando artigos...</span>
            </div>
          )}

          {/* Grid de artigos */}
          {!loadingArtigos && artigos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4">
              {artigos.map((artigo) => (
                <ArtigoCard
                  key={artigo._id}
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

          {/* Janela vazia */}
          {!loadingArtigos && artigos.length === 0 && (
            <div className="text-center py-12">
              <FileTextIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Nenhum artigo encontrado
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || filterStatus !== "todos"
                  ? "Tente ajustar os filtros de pesquisa"
                  : "Comece adicionando artigos a este projeto"}
              </p>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={handleImportarBibTeX}
                >
                  <UploadIcon className="h-4 w-4" />
                  Importar BibTeX
                </Button>
                <Button
                  className="flex items-center gap-2"
                  onClick={handleAdicionarArtigo}
                >
                  <PlusIcon className="h-4 w-4" />
                  Adicionar {artigos.length === 0 ? "Primeiro " : ""}Artigo
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal para adicionar artigo */}
      <NovoArtigoModal
        isOpen={showNovoArtigoModal}
        onClose={() => setShowNovoArtigoModal(false)}
        onSuccess={handleNovoArtigoSuccess}
        projectId={projeto._id}
      />

      {/* Modal para importar BibTeX */}
      <ImportarBibTeXModal
        isOpen={showImportarModal}
        onClose={() => setShowImportarModal(false)}
        onSuccess={handleImportarSuccess}
        projectId={projeto._id}
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

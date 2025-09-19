import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  PlusIcon,
  SearchIcon,
  FilterIcon,
  FileTextIcon,
  LoaderIcon,
  MoreVerticalIcon,
  EditIcon,
  TrashIcon,
  EyeIcon,
  UploadIcon,
  FileIcon,
  CheckIcon,
  ClockIcon,
  XIcon,
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
  const getStatusBadge = (status) => {
    switch (status) {
      case "analisado":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckIcon className="h-3 w-3" />
            Analisado
          </span>
        );
      case "pendente":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            <ClockIcon className="h-3 w-3" />
            Pendente
          </span>
        );
      case "excluido":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            <XIcon className="h-3 w-3" />
            Excluído
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
            <ClockIcon className="h-3 w-3" />
            Pendente
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Barra de pesquisa e filtros */}
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

      {/* Tabela de artigos */}
      {!loadingArtigos && artigos.length > 0 && (
        <>
          {/* Versão desktop - tabela */}
          <div className="border rounded-lg overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px] min-w-[250px]">
                    Título
                  </TableHead>
                  <TableHead className="w-[200px] min-w-[150px]">
                    Autores
                  </TableHead>
                  <TableHead className="w-[80px]">Ano</TableHead>
                  <TableHead className="w-[200px] min-w-[150px]">
                    Revista/Conferência
                  </TableHead>
                  <TableHead className="w-[100px]">Páginas</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {artigos.map((artigo) => (
                  <TableRow key={artigo._id}>
                    <TableCell className="font-medium max-w-[300px]">
                      <div className="flex items-center gap-2">
                        <FileIcon
                          className={`h-4 w-4 flex-shrink-0 ${
                            artigo.pdfFile
                              ? "text-blue-500"
                              : "text-muted-foreground"
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
                        {!artigo.pdfFile && (
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
                    <TableCell className="text-center">
                      <span className="text-sm text-muted-foreground">
                        {artigo.pages || "-"}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(artigo.status)}</TableCell>
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
    </div>
  );
}

export default ArtigosTabela;

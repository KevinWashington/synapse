import { useState } from "react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  LoaderIcon,
  UploadIcon,
  FileIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { articleService } from "../services/artigosService.js";

function UploadPDFModal({ isOpen, onClose, onSuccess, projeto, artigo }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedFile) {
      setError("Por favor, selecione um arquivo PDF");
      return;
    }

    if (selectedFile.type !== "application/pdf") {
      setError("Por favor, selecione apenas arquivos PDF");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const formData = new FormData();
      formData.append("pdf", selectedFile);

      await articleService.updateArticle(projeto._id, artigo._id, formData);

      alert("PDF atualizado com sucesso!");
      onSuccess();
      handleClose();
    } catch (err) {
      console.error("Erro ao atualizar PDF:", err);
      setError("Erro ao atualizar PDF: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setError("");
    onClose();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
    setError("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadIcon className="h-5 w-5" />
            Upload de PDF
          </DialogTitle>
          <DialogDescription>
            Faça upload do PDF para o artigo "{artigo?.title}".
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Upload de arquivo */}
          <div className="space-y-2">
            <Label htmlFor="pdf-file">Arquivo PDF</Label>
            <div className="flex items-center gap-2">
              <input
                id="pdf-file"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById("pdf-file").click()}
                className="flex items-center gap-2 w-full"
              >
                <FileIcon className="h-4 w-4" />
                {selectedFile ? selectedFile.name : "Selecionar PDF"}
              </Button>
            </div>
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Arquivo selecionado: {selectedFile.name} (
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          {/* Erro */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 dark:bg-red-900 dark:border-red-800 dark:text-red-200">
              <AlertTriangleIcon className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Botões */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !selectedFile}>
              {loading ? (
                <>
                  <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <UploadIcon className="h-4 w-4 mr-2" />
                  Enviar PDF
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default UploadPDFModal;

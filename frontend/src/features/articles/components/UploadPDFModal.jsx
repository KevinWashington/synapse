import { useState } from "react";
import { FileIcon, LoaderIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import ArticleDialogErrorAlert from "@features/articles/components/ArticleDialogErrorAlert";
import ArticleDialogFooter from "@features/articles/components/ArticleDialogFooter";
import { articleService } from "@features/articles/services/articleService";
import { toast } from "@/lib/toast";

function UploadPDFModal({ isOpen, onClose, onSuccess, project, article }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();

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

      await articleService.uploadPdf(project.id, article.id, selectedFile);

      toast.success("PDF atualizado com sucesso!");
      onSuccess();
      handleClose();
    } catch (requestError) {
      console.error("Erro ao atualizar PDF:", requestError);
      setError(`Erro ao atualizar PDF: ${requestError.message}`);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setSelectedFile(null);
    setError("");
    onClose();
  }

  function handleFileChange(event) {
    const file = event.target.files[0];
    setSelectedFile(file);
    setError("");
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadIcon className="h-5 w-5" />
            Upload de PDF
          </DialogTitle>
          <DialogDescription>
            Faça upload do PDF para o artigo "{article?.title}".
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
                className="flex w-full items-center gap-2"
              >
                <FileIcon className="h-4 w-4" />
                {selectedFile ? selectedFile.name : "Selecionar PDF"}
              </Button>
            </div>
            {selectedFile ? (
              <p className="text-sm text-muted-foreground">
                Arquivo selecionado: {selectedFile.name} (
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            ) : null}
          </div>

          <ArticleDialogErrorAlert error={error} />

          <ArticleDialogFooter
            confirmIcon={UploadIcon}
            confirmLabel="Enviar PDF"
            disabled={loading || !selectedFile}
            loading={loading}
            loadingLabel={
              <>
                <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            }
            onCancel={handleClose}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default UploadPDFModal;


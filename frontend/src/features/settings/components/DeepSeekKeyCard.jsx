import { useState } from "react";
import { CheckCircle2, Eye, EyeOff, ExternalLink, KeyRound, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

function DeepSeekKeyCard({ status, loading = false, saving = false, error, notice, onSave, onDelete }) {
  const [apiKey, setApiKey] = useState("");
  const [visible, setVisible] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!apiKey.trim()) return;
    const saved = await onSave(apiKey.trim());
    if (saved) {
      setApiKey("");
      setVisible(false);
    }
  }

  async function handleDelete() {
    const deleted = await onDelete();
    if (deleted) setConfirmDelete(false);
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef1ff] text-[#6259ff]">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <CardTitle>Integração com DeepSeek</CardTitle>
            <CardDescription>Chave opcional e exclusiva da sua conta.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm leading-6 text-muted-foreground">
          Você pode usar o Synapse sem uma chave. Ela será necessária apenas ao executar recursos de IA e fica criptografada no servidor.
        </p>
        {loading ? <p role="status" className="text-sm text-muted-foreground">Verificando configuração...</p> : null}
        {!loading && status?.configured ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-700" />
              <div>
                <p className="text-sm font-medium text-emerald-950">Chave configurada</p>
                <p className="font-mono text-sm text-emerald-800">{status.maskedKey}</p>
              </div>
            </div>
            {!confirmDelete ? (
              <Button type="button" variant="outline" onClick={() => setConfirmDelete(true)} disabled={saving}>
                <Trash2 className="h-4 w-4" /> Remover chave
              </Button>
            ) : (
              <div className="flex gap-2" role="group" aria-label="Confirmar remoção da chave">
                <Button type="button" variant="destructive" onClick={handleDelete} disabled={saving}>Confirmar remoção</Button>
                <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)} disabled={saving}>Cancelar</Button>
              </div>
            )}
          </div>
        ) : null}
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="deepseek-api-key">Chave da API DeepSeek</Label>
            <div className="flex gap-2">
              <Input
                id="deepseek-api-key"
                type={visible ? "text" : "password"}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                autoComplete="off"
                placeholder={status?.configured ? "Cole uma nova chave para substituir" : "sk-..."}
                disabled={saving}
              />
              <Button type="button" variant="outline" aria-label={visible ? "Ocultar chave" : "Mostrar chave"} onClick={() => setVisible((value) => !value)}>
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-[#6259ff] hover:underline">
              Criar uma chave na DeepSeek <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Button type="submit" disabled={saving || !apiKey.trim()}>
              {saving ? "Validando..." : status?.configured ? "Substituir chave" : "Salvar chave"}
            </Button>
          </div>
        </form>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        {notice ? <p role="status" className="text-sm text-emerald-700">{notice}</p> : null}
      </CardContent>
    </Card>
  );
}

export default DeepSeekKeyCard;

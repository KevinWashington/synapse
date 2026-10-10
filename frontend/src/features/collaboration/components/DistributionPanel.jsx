import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import TeamSelect from "./TeamSelect";

function ReassignmentRow({
  assignment,
  reviewers,
  assignments,
  onReassign,
  disabled,
}) {
  const [reviewer, setReviewer] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const label = `artigo ${assignment.articleId}, vaga ${assignment.slot}`;
  const available = reviewers.filter(
    (member) =>
      !assignments.some(
        (item) =>
          item.id !== assignment.id &&
          item.articleId === assignment.articleId &&
          item.phase === assignment.phase &&
          item.status !== "cancelled" &&
          item.reviewerUserId === member.userId,
      ),
  );
  async function reassign() {
    if (!reviewer || pending || disabled) return;
    setPending(true);
    setError(null);
    try {
      await onReassign(assignment.id, { reviewerUserId: Number(reviewer) });
      setReviewer("");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setPending(false);
    }
  }
  return (
    <li className="grid min-w-0 gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
      <p className="text-sm">
        Artigo {assignment.articleId} ·{" "}
        {assignment.phase === "screening" ? "Triagem" : "Elegibilidade"} · Vaga{" "}
        {assignment.slot}
      </p>
      <TeamSelect
        label={`Novo revisor do ${label}`}
        value={reviewer}
        disabled={pending || disabled}
        onValueChange={setReviewer}
        options={available.map((member) => ({
          value: String(member.userId),
          label: member.name || member.email,
        }))}
      />
      <Button
        variant="outline"
        aria-label={`Reatribuir ${label}`}
        disabled={!reviewer || pending || disabled}
        onClick={reassign}
      >
        Reatribuir
      </Button>
      {!available.length && (
        <p className="text-sm text-muted-foreground sm:col-span-3">
          Nenhum revisor disponível para esta vaga. Adicione outra pessoa à
          revisão.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive sm:col-span-3">
          {error}
        </p>
      )}
    </li>
  );
}

export default function DistributionPanel({ collaboration, embedded = false }) {
  const {
    members,
    assignments,
    previewAssignments,
    distributeAssignments,
    previewAdaptation,
    adaptAssignments,
    reassignAssignment,
    capabilities,
  } = collaboration;
  const [phase, setPhase] = useState("screening");
  const [preview, setPreview] = useState(null);
  const [previewTeam, setPreviewTeam] = useState(null);
  const [previewAssignmentSet, setPreviewAssignmentSet] = useState(null);
  const [pending, setPending] = useState(false);
  const [reassignmentPending, setReassignmentPending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [previewKind, setPreviewKind] = useState("distribution");
  const [vacancyPage, setVacancyPage] = useState(1);
  const reviewers = members.filter(
    (member) => member.status === "active" && member.participatesInReview,
  );
  const teamKey = JSON.stringify(
    reviewers.map((member) => [member.userId, member.role]),
  );
  const validPreview =
    !reassignmentPending &&
    preview?.phase === phase &&
    previewTeam === teamKey &&
    previewAssignmentSet === assignments;
  if (!capabilities.includes("manage_distribution")) return null;
  async function run(confirm, kind = previewKind) {
    if (pending || reassignmentPending || (confirm && !validPreview)) return;
    setPending(true);
    setError(null);
    setSuccess(false);
    try {
      if (confirm) {
        if (kind === "adaptation") await adaptAssignments({ phase, fingerprint: preview.fingerprint });
        else await distributeAssignments({ phase });
        setPreview(null);
        setSuccess(kind);
      } else {
        setPreview(null);
        setPreviewKind(kind);
        const result = await (kind === "adaptation" ? previewAdaptation : previewAssignments)({ phase });
        setPreview(result);
        setPreviewTeam(teamKey);
        setPreviewAssignmentSet(assignments);
      }
    } catch (failure) {
      setError(failure.message || "Não foi possível distribuir os artigos.");
      setPreview(null);
    } finally {
      setPending(false);
    }
  }
  async function reassign(...args) {
    if (pending || reassignmentPending) return;
    setPreview(null);
    setSuccess(false);
    setReassignmentPending(true);
    try {
      return await reassignAssignment(...args);
    } finally {
      setReassignmentPending(false);
    }
  }
  const unavailable = assignments.filter(
    (assignment) => assignment.status === "needs_reassignment" && assignment.phase === phase,
  );
  const pages = Math.max(1, Math.ceil(unavailable.length / 20));
  const currentPage = Math.min(vacancyPage, pages);
  const visibleVacancies = unavailable.slice((currentPage - 1) * 20, currentPage * 20);
  return (
    <Card className={embedded ? "min-w-0 gap-0 rounded-none border-0 bg-transparent py-0 shadow-none" : "min-w-0 shadow-none"}>
      <CardHeader className={embedded ? "border-b border-[#edf0f7] px-4 py-4 sm:px-5" : undefined}>
        <h2 className="text-sm font-semibold">Distribuição de artigos</h2>
        <p className="text-xs text-[#667391]">
          Confira a carga planejada antes de confirmar a distribuição.
        </p>
      </CardHeader>
      <CardContent className={`grid min-w-0 gap-4 ${embedded ? "px-4 py-5 sm:px-5" : ""}`}>
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
          <div className="grid gap-2">
            <span className="text-sm font-medium">Etapa</span>
            <TeamSelect
              label="Etapa da distribuição"
              value={phase}
              disabled={pending || reassignmentPending}
              onValueChange={(value) => {
                setPhase(value);
                setPreview(null);
                setSuccess(false);
                setVacancyPage(1);
              }}
              options={[
                { value: "screening", label: "Triagem" },
                { value: "eligibility", label: "Elegibilidade" },
              ]}
            />
          </div>
          <Button
            variant="outline"
            disabled={pending || reassignmentPending || !reviewers.length}
            onClick={() => run(false, "distribution")}
          >
            Pré-visualizar distribuição
          </Button>
          <Button variant="outline" disabled={pending || reassignmentPending || !reviewers.length} onClick={() => run(false, "adaptation")}>
            Adaptar à equipe atual
          </Button>
        </div>
        <p className="text-xs leading-5 text-[#667391]">Distribuir cria atribuições para artigos ainda não distribuídos. Adaptar ajusta as revisões em andamento ao número atual de revisores, sem apagar decisões enviadas.</p>
        {pending && <p role="status" className="flex items-center gap-2 text-sm text-[#554bea]"><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />{previewKind === "adaptation" ? "Preparando adaptação…" : "Preparando distribuição…"}</p>}
        {!reviewers.length && (
          <p role="status" className="text-sm">
            Nenhum revisor disponível. Convide uma pessoa ou habilite a
            participação de um coordenador na revisão.
          </p>
        )}
        {validPreview && previewKind === "adaptation" && (
          <section aria-label="Prévia da adaptação" className="grid gap-3 rounded-xl border border-[#d9d4ff] bg-[#f5f3ff] p-4">
            <h3 className="text-sm font-semibold text-[#4035a8]">{preview.reviewsPerArticle === 1 ? "Revisão individual" : "Revisão por duas pessoas"} · {preview.reviewerCount} revisor(es) na equipe</h3>
            <p className="text-sm">{preview.articleCount} artigos serão adaptados nesta etapa.</p>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-[#667391]">Vagas dispensadas ou substituídas</dt><dd className="mt-1 font-semibold">{preview.cancelledCount}</dd></div>
              <div><dt className="text-[#667391]">Novas atribuições</dt><dd className="mt-1 font-semibold">{preview.assignedCount}</dd></div>
              <div><dt className="text-[#667391]">Decisões prontas para consolidar</dt><dd className="mt-1 font-semibold">{preview.consolidatedCount}</dd></div>
            </dl>
            <p className="text-xs leading-5 text-[#667391]">Decisões enviadas serão preservadas, inclusive de pessoas removidas. Artigos concluídos e discordâncias não serão alterados.{preview.reviewsPerArticle === 1 ? " Ao confirmar, as revisões em andamento poderão ser concluídas com uma única decisão." : " Cada artigo terá até duas pessoas distintas; novos revisores preenchem as vagas disponíveis."}</p>
            {!preview.articleCount && <p className="text-sm">A distribuição desta etapa já está adaptada à equipe atual.</p>}
            <div className="flex flex-wrap gap-2">
              <Button className="bg-[#6259ff] text-white hover:bg-[#554bea]" disabled={pending || reassignmentPending || !preview.articleCount} onClick={() => run(true)}>Confirmar adaptação</Button>
              <Button variant="outline" disabled={pending} onClick={() => setPreview(null)}>Cancelar</Button>
            </div>
          </section>
        )}
        {validPreview && previewKind === "distribution" && (
          <div className="grid gap-3 rounded-lg bg-muted/40 p-4">
            <p className="font-medium">
              {preview.articleCount} artigos · {preview.reviewerCount} revisores
            </p>
            <ul className="grid gap-1 text-sm">
              {Object.entries(preview.loads || {}).map(([id, count]) => (
                <li key={id}>
                  {members.find((member) => String(member.userId) === id)
                    ?.name || `Revisor ${id}`}
                  : {count} atribuições
                </li>
              ))}
            </ul>
            {!preview.articleCount && (
              <p className="text-sm">
                Nenhum artigo disponível para distribuir nesta etapa.
              </p>
            )}
            <Button
              className={embedded ? "bg-[#6259ff] text-white hover:bg-[#554bea]" : undefined}
              disabled={
                pending ||
                reassignmentPending ||
                !preview.reviewerCount ||
                !preview.articleCount ||
                !preview.assignments?.length
              }
              onClick={() => run(true)}
            >
              Confirmar distribuição
            </Button>
          </div>
        )}
        {success && (
          <p role="status" className="text-sm">
            {success === "adaptation" ? "Distribuição adaptada à equipe atual." : "Distribuição confirmada."}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {unavailable.length > 0 && (
          <section className="grid min-w-0 gap-3">
            <h3 className="font-medium">
              Atenção: {unavailable.length} vaga(s) precisa de reatribuição
            </h3>
            <p className="text-sm text-muted-foreground">
              O revisor anterior não está disponível. Escolha uma pessoa para
              cada vaga ou use “Adaptar à equipe atual” para ajustar as revisões em andamento em lote.
            </p>
            <ul className="grid min-w-0 gap-3">
              {visibleVacancies.map((assignment) => (
                <ReassignmentRow
                  key={assignment.id}
                  assignment={assignment}
                  reviewers={reviewers}
                  assignments={assignments}
                  onReassign={reassign}
                  disabled={pending || reassignmentPending}
                />
              ))}
            </ul>
            {pages > 1 && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#edf0f7] pt-3 text-xs text-[#667391]">
              <span>Página {currentPage} de {pages} · {unavailable.length} pendências nesta etapa</span>
              <div className="flex gap-2"><Button size="sm" variant="outline" aria-label="Pendências anteriores" disabled={currentPage === 1 || pending || reassignmentPending} onClick={() => setVacancyPage(currentPage - 1)}>Anterior</Button><Button size="sm" variant="outline" aria-label="Próximas pendências" disabled={currentPage === pages || pending || reassignmentPending} onClick={() => setVacancyPage(currentPage + 1)}>Próxima</Button></div>
            </div>}
          </section>
        )}
      </CardContent>
    </Card>
  );
}

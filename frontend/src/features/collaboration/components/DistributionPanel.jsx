import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import TeamSelect from "./TeamSelect";

function ReassignmentRow({ assignment, reviewers, assignments, onReassign }) {
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
    if (!reviewer || pending) return;
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
        disabled={pending}
        onValueChange={setReviewer}
        options={available.map((member) => ({
          value: String(member.userId),
          label: member.name || member.email,
        }))}
      />
      <Button
        variant="outline"
        aria-label={`Reatribuir ${label}`}
        disabled={!reviewer || pending}
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

export default function DistributionPanel({ collaboration }) {
  const {
    members,
    assignments,
    previewAssignments,
    distributeAssignments,
    reassignAssignment,
    capabilities,
  } = collaboration;
  const [phase, setPhase] = useState("screening");
  const [preview, setPreview] = useState(null);
  const [previewTeam, setPreviewTeam] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const reviewers = members.filter(
    (member) => member.status === "active" && member.participatesInReview,
  );
  const teamKey = JSON.stringify(
    reviewers.map((member) => [member.userId, member.role]),
  );
  const validPreview = preview?.phase === phase && previewTeam === teamKey;
  if (!capabilities.includes("manage_distribution")) return null;
  async function run(confirm) {
    if (pending) return;
    setPending(true);
    setError(null);
    setSuccess(false);
    try {
      if (confirm) {
        await distributeAssignments({ phase });
        setPreview(null);
        setSuccess(true);
      } else {
        const result = await previewAssignments({ phase });
        setPreview(result);
        setPreviewTeam(teamKey);
      }
    } catch (failure) {
      setError(failure.message || "Não foi possível distribuir os artigos.");
      setPreview(null);
    } finally {
      setPending(false);
    }
  }
  const unavailable = assignments.filter(
    (assignment) => assignment.status === "needs_reassignment",
  );
  return (
    <Card className="min-w-0 shadow-none">
      <CardHeader>
        <h2 className="font-semibold">Distribuição de artigos</h2>
        <p className="text-sm text-muted-foreground">
          Confira a carga planejada antes de confirmar a distribuição.
        </p>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-2">
            <span className="text-sm font-medium">Etapa</span>
            <TeamSelect
              label="Etapa da distribuição"
              value={phase}
              disabled={pending}
              onValueChange={(value) => {
                setPhase(value);
                setPreview(null);
                setSuccess(false);
              }}
              options={[
                { value: "screening", label: "Triagem" },
                { value: "eligibility", label: "Elegibilidade" },
              ]}
            />
          </div>
          <Button
            variant="outline"
            disabled={pending || !reviewers.length}
            onClick={() => run(false)}
          >
            Pré-visualizar distribuição
          </Button>
        </div>
        {!reviewers.length && (
          <p role="status" className="text-sm">
            Nenhum revisor disponível. Convide uma pessoa ou habilite a
            participação de um coordenador na revisão.
          </p>
        )}
        {validPreview && (
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
              disabled={
                pending ||
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
            Distribuição confirmada.
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
              cada vaga.
            </p>
            <ul className="grid min-w-0 gap-3">
              {unavailable.map((assignment) => (
                <ReassignmentRow
                  key={assignment.id}
                  assignment={assignment}
                  reviewers={reviewers}
                  assignments={assignments}
                  onReassign={reassignAssignment}
                />
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}

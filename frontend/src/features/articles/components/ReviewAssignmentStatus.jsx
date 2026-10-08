import { collaborativeReview } from "../utils/collaborativeReview";

export default function ReviewAssignmentStatus({ article }) {
  const review = collaborativeReview(article);
  if (!review.managed) return null;
  const assignments = article.reviewAssignments || [];
  const submitted = assignments.filter((item) => item.status === "submitted").length;
  return (
    <div className="space-y-2 text-xs" aria-live="polite">
      <span title={review.explanation || review.label} className={`inline-flex rounded-full px-3 py-1 font-semibold ${review.className}`}>
        {review.label}
      </span>
      {review.explanation ? <p className="text-[#56627f]">{review.explanation}</p> : null}
      {assignments.length ? <p className="text-[#667391]" title={assignments.map((item) => `Revisor ${item.reviewerUserId}: ${item.status === "submitted" ? "concluído" : item.status === "needs_reassignment" ? "redistribuição necessária" : "pendente"}`).join("; ")}>
        {submitted} de {assignments.length} revisores concluíram
      </p> : null}
    </div>
  );
}

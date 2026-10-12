export default function DecisionPanel({ title, description, review, article, onKeyDown, children }) {
  return (
    <aside aria-label={title} onKeyDown={onKeyDown} className="min-h-full min-w-0 bg-[#fbfcff]">
      <header className="border-b border-[#edf0f7] p-4 sm:p-5">
        <h2 className="text-base font-semibold tracking-[-0.02em] text-[#111936]">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-[#667391]">{description}</p>
      </header>
      <div className="space-y-4 p-4 sm:p-5">
        {review.explanation && <p role="status" className="rounded-lg border border-[#ffe2a8] bg-[#fff9ed] px-3 py-2 text-xs leading-5 text-[#8a5a00]">{review.explanation}</p>}
        {article.myReviewAssignment?.status === "submitted" && <p className="text-xs leading-5 text-[#667391]">Sua decisão e justificativa aparecem no painel do artigo.</p>}
        {children}
      </div>
    </aside>
  );
}

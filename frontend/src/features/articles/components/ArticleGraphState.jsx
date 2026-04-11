function ArticleGraphState({ children, tone = "default" }) {
  const borderClassName =
    tone === "error"
      ? "border-destructive/50"
      : "border-[var(--syn-border)]";

  return (
    <div
      className={`rounded-[var(--syn-radius-card)] border ${borderClassName} bg-[var(--syn-bg-primary)] shadow-[var(--syn-shadow-card)]`}
    >
      <div className="flex items-center justify-center py-16">{children}</div>
    </div>
  );
}

export default ArticleGraphState;

import { useEffect, useCallback } from "react";
import { X, Share2, Maximize2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function SlidePanel({
  isOpen,
  onClose,
  title,
  breadcrumb,
  badge,
  onShare,
  onExpand,
  onMore,
  footer,
  children,
  width = "max-w-lg",
  className,
}) {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") onClose?.();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] transition-[opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "fixed top-0 right-0 z-50 flex h-full w-full flex-col transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          width,
          "bg-[var(--syn-bg-primary)] dark:bg-[var(--syn-bg-primary)]",
          "shadow-[var(--syn-shadow-modal)]",
          isOpen ? "translate-x-0" : "translate-x-full",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--syn-border)]">
          <div className="flex-1 min-w-0">
            {breadcrumb && (
              <p className="text-xs font-medium text-[var(--syn-text-secondary)] mb-1 uppercase tracking-wide">
                {breadcrumb}
              </p>
            )}
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-[var(--syn-text-primary)] truncate">
                {title}
              </h2>
              {badge}
            </div>
          </div>

          <div className="flex items-center gap-1 ml-4 flex-shrink-0">
            {onShare && (
              <Button variant="ghost" size="icon" onClick={onShare} className="h-8 w-8">
                <Share2 className="h-4 w-4" />
              </Button>
            )}
            {onExpand && (
              <Button variant="ghost" size="icon" onClick={onExpand} className="h-8 w-8">
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
            {onMore && (
              <Button variant="ghost" size="icon" onClick={onMore} className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-[var(--syn-border)] px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}


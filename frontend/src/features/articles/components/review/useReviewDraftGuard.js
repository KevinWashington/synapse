import { useCallback, useRef, useState } from "react";

export function useReviewDraftGuard({ isDirty, confirmDiscard } = {}) {
  const pendingAction = useRef(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const guard = useCallback((action) => {
    if (!isDirty) {
      action?.();
      return true;
    }

    pendingAction.current = action;
    setIsConfirmOpen(true);
    return false;
  }, [isDirty]);

  const cancel = useCallback(() => {
    pendingAction.current = null;
    setIsConfirmOpen(false);
  }, []);

  const confirm = useCallback(() => {
    const action = pendingAction.current;
    pendingAction.current = null;
    setIsConfirmOpen(false);
    confirmDiscard?.();
    action?.();
  }, [confirmDiscard]);

  return { guard, isConfirmOpen, confirm, cancel };
}

import { createContext, useContext, useState, useEffect, useCallback } from "react";

const PageTitleContext = createContext(null);

export function PageTitleProvider({ children }) {
  const [pageTitle, setPageTitle] = useState({
    title: "",
    backUrl: null,
    actions: null,
    badge: null,
  });

  return (
    <PageTitleContext.Provider value={{ pageTitle, setPageTitle }}>
      {children}
    </PageTitleContext.Provider>
  );
}

/**
 * Hook for pages to set the header title, back button, badge, and actions.
 * Clears on unmount.
 */
export function usePageTitle({ title, backUrl, actions, badge } = {}) {
  const ctx = useContext(PageTitleContext);
  if (!ctx) throw new Error("usePageTitle must be used within PageTitleProvider");

  const { setPageTitle } = ctx;

  useEffect(() => {
    setPageTitle({ title, backUrl, actions, badge });
    return () => setPageTitle({ title: "", backUrl: null, actions: null, badge: null });
  }, [title, backUrl, setPageTitle]);

  // Allow imperative updates for actions/badge that change frequently
  const updatePageTitle = useCallback(
    (updates) => setPageTitle((prev) => ({ ...prev, ...updates })),
    [setPageTitle]
  );

  return updatePageTitle;
}

/**
 * Hook for Layout to read the current page title info.
 */
export function usePageTitleValue() {
  const ctx = useContext(PageTitleContext);
  if (!ctx) throw new Error("usePageTitleValue must be used within PageTitleProvider");
  return ctx.pageTitle;
}

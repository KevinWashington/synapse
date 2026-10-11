import { useCallback, useEffect, useRef, useState } from "react";

// Identity is local to this hook: requests never share a global cache.
export function useRemoteResource({ key, enabled = true, load }) {
  const [state, setState] = useState({ key, data: null, loading: enabled, error: null });
  const identity = useRef({ key, enabled });
  identity.current = { key, enabled };
  const loader = useRef(load);
  loader.current = load;
  const sequence = useRef(0);
  const mounted = useRef(false);
  const reload = useCallback(async (...args) => {
    const { key: requestKey, enabled: requestEnabled } = identity.current;
    if (!requestEnabled || !mounted.current) return null;
    const request = ++sequence.current;
    const isCurrent = () => mounted.current && identity.current.key === requestKey && identity.current.enabled && sequence.current === request;
    setState((old) => ({ key: requestKey, data: old.key === requestKey ? old.data : null, loading: true, error: null }));
    try {
      const data = await loader.current(...args);
      if (!isCurrent()) return null;
      setState({ key: requestKey, data, loading: false, error: null });
      return data;
    } catch (error) {
      if (isCurrent()) setState((old) => ({ ...old, loading: false, error }));
      return null;
    }
  }, []);
  // Scoped updates allow a feature mutation to replace its own remote snapshot.
  const setData = useCallback((value) => {
    if (!mounted.current || identity.current.key !== key || !identity.current.enabled) return;
    sequence.current += 1;
    setState((old) => ({ key, data: typeof value === "function" ? value(old.key === key ? old.data : null) : value, loading: false, error: null }));
  }, [key]);
  useEffect(() => {
    mounted.current = true;
    reload();
    return () => { mounted.current = false; sequence.current += 1; };
  }, [enabled, key, reload]);
  const current = enabled && state.key === key ? state : { data: null, loading: enabled, error: null };
  return { data: current.data, loading: current.loading, error: current.error, reload, setData };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client";

function GoogleSignInButton({ onCredential, disabled = false }) {
  const containerRef = useRef(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState("loading");
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const initialize = useCallback(() => {
    if (!window.google?.accounts?.id || !containerRef.current) {
      setState("error");
      return;
    }
    containerRef.current.replaceChildren();
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: ({ credential }) => credential && onCredential(credential),
    });
    window.google.accounts.id.renderButton(containerRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      width: 360,
    });
    setState("ready");
  }, [clientId, onCredential]);

  useEffect(() => {
    if (!clientId) {
      setState("misconfigured");
      return undefined;
    }
    if (window.google?.accounts?.id) {
      initialize();
      return undefined;
    }

    setState("loading");
    let script = document.querySelector(`script[src="${GOOGLE_SCRIPT_URL}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = GOOGLE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", initialize);
    const handleError = () => setState("error");
    script.addEventListener("error", handleError);
    return () => {
      script.removeEventListener("load", initialize);
      script.removeEventListener("error", handleError);
    };
  }, [attempt, clientId, initialize]);

  if (!clientId) {
    return <p role="alert" className="text-sm text-amber-700">Google ainda nao configurado para este ambiente.</p>;
  }

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className={disabled ? "pointer-events-none opacity-60" : "flex min-h-11 justify-center"}
        aria-busy={state === "loading"}
      />
      {state === "loading" ? <p className="text-center text-sm text-muted-foreground">Carregando login seguro...</p> : null}
      {state === "error" ? (
        <div role="alert" className="space-y-2 text-center text-sm text-red-700">
          <p>Nao foi possivel carregar o login do Google.</p>
          <Button type="button" variant="outline" onClick={() => setAttempt((value) => value + 1)}>
            Tentar novamente
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export default GoogleSignInButton;

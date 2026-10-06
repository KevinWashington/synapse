import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BrainCircuit, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuth } from "@features/auth";
import AuthErrorAlert from "@features/auth/components/AuthErrorAlert";
import GoogleSignInButton from "@features/auth/components/GoogleSignInButton";

function LoginScreen() {
  const [submitting, setSubmitting] = useState(false);
  const { loginWithGoogle, error, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destination = location.state?.from?.pathname || "/";

  useEffect(() => {
    if (isAuthenticated()) navigate(destination, { replace: true });
  }, [destination, isAuthenticated, navigate]);

  const handleCredential = useCallback(async (credential) => {
    setSubmitting(true);
    const result = await loginWithGoogle(credential);
    setSubmitting(false);
    if (result.success) navigate(destination, { replace: true });
  }, [destination, loginWithGoogle, navigate]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f6f7fb] px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(99,91,255,0.14),_transparent_38%)]" />
      <Card className="relative w-full max-w-md border-[#e7e9f3] bg-white/95 shadow-xl shadow-[#28346b]/10 backdrop-blur">
        <CardHeader className="space-y-4 pb-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#6259ff] text-white shadow-lg shadow-[#6259ff]/20">
            <BrainCircuit className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold text-[#111936]">Entre no Synapse</CardTitle>
            <CardDescription className="text-sm leading-6">
              Organize sua revisão sistemática e trabalhe com IA usando sua própria chave.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <AuthErrorAlert error={error} />
          <GoogleSignInButton onCredential={handleCredential} disabled={submitting} />
          {submitting ? <p role="status" className="text-center text-sm text-muted-foreground">Validando sua conta...</p> : null}
          <div className="flex items-start gap-2 rounded-xl bg-[#f6f7fb] p-3 text-xs leading-5 text-[#56627f]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#6259ff]" />
            <p>Usamos o Google apenas para sua identidade. Sua sessão fica protegida no navegador e nenhuma senha é armazenada pelo Synapse.</p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export default LoginScreen;

import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  FileSearch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
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
    <main className="relative min-h-screen overflow-hidden bg-[#f7f8fc] text-[#111936]">
      <div className="pointer-events-none absolute -left-48 -top-48 h-[520px] w-[520px] rounded-full bg-[#e8e5ff] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-64 right-[-10rem] h-[560px] w-[560px] rounded-full bg-[#e1f5ec] blur-3xl" />
      <div className="relative mx-auto grid min-h-screen w-full max-w-[1240px] items-center gap-12 px-6 py-8 sm:px-10 lg:grid-cols-[1.12fr_0.88fr] lg:gap-16 lg:px-14 xl:px-8">
        <section className="py-4 lg:py-12">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#6259ff] text-white shadow-[0_12px_30px_rgba(98,89,255,0.25)]">
              <BrainCircuit className="h-5 w-5" />
            </span>
            <div>
              <p className="text-lg font-bold tracking-[-0.02em]">Synapse</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7a849d]">Revisão sistemática</p>
            </div>
          </div>

          <div className="mt-12 max-w-[620px] sm:mt-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dedaff] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#6259ff] backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Pesquisa rigorosa, fluxo simples
            </div>
            <h1 className="mt-5 max-w-[590px] text-[2.5rem] font-bold leading-[1.08] tracking-[-0.045em] sm:text-5xl lg:text-[3.4rem]">
              Transforme pesquisa em evidência confiável.
            </h1>
            <p className="mt-5 max-w-[570px] text-base leading-7 text-[#5e6985] sm:text-lg sm:leading-8">
              Conduza sua revisão do primeiro artigo à síntese final com decisões rastreáveis e IA sob seu controle.
            </p>
          </div>

          <ol className="mt-9 hidden max-w-[590px] grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-3 sm:grid">
            <FlowStep icon={FileSearch} number="01" label="Identifique" />
            <ArrowRight className="h-4 w-4 text-[#a8b0c3]" aria-hidden="true" />
            <FlowStep icon={ShieldCheck} number="02" label="Avalie" />
            <ArrowRight className="h-4 w-4 text-[#a8b0c3]" aria-hidden="true" />
            <FlowStep icon={CheckCircle2} number="03" label="Sintetize" />
          </ol>
        </section>

        <section className="w-full border-t border-[#dfe3ed] py-10 lg:border-l lg:border-t-0 lg:py-16 lg:pl-16 xl:pl-20">
          <div className="w-full max-w-[420px] lg:ml-auto">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6259ff]">Acesso seguro</p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-[#111936]">Acesse seu espaço de revisão</h2>
            <p className="mt-3 text-sm leading-6 text-[#667391]">
              Entre com sua conta Google para continuar de onde parou.
            </p>

            <div className="mt-8 space-y-5">
              <AuthErrorAlert error={error} />
              <GoogleSignInButton onCredential={handleCredential} disabled={submitting} />
              {submitting ? <p role="status" className="text-center text-sm text-muted-foreground">Validando sua conta...</p> : null}
            </div>

            <div className="mt-7 flex items-start gap-3 border-t border-[#e4e7ef] pt-5 text-xs leading-5 text-[#667391]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#36a96b]" />
              <p>O Google confirma apenas sua identidade. O Synapse não recebe nem armazena sua senha.</p>
            </div>

            <p className="mt-10 text-xs text-[#929bb0]">Ao continuar, você acessa um ambiente privado vinculado à sua conta.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

function FlowStep({ icon: Icon, number, label }) {
  return (
    <li className="flex min-w-0 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e0e3ee] bg-white/80 text-[#6259ff] shadow-sm">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-bold tracking-[0.16em] text-[#9aa3b7]">{number}</span>
        <span className="block text-sm font-semibold text-[#293452]">{label}</span>
      </span>
    </li>
  );
}

export default LoginScreen;

import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { readingUrl } from "../utils/readingResume";
export default function ReadingResumePanel({ resume }) {
  return <section aria-label="Continuar leitura" className="flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-xl border border-[#e2e6ef] bg-white p-4 sm:p-5">
    <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-[#111936]">Continuar de onde parei</h2>
      {resume.loading ? <p role="status" className="mt-1 text-sm text-[#667391]">Verificando sua última leitura…</p> : resume.error ? <p role="alert" className="mt-1 text-sm text-[#667391]">Não foi possível verificar sua última leitura.</p> : resume.article ? <><p className="mt-1 line-clamp-1 text-sm text-[#111936]">{resume.article.title}</p><p className="mt-1 truncate text-xs text-[#667391]">{resume.project.title}</p></> : <p className="mt-1 text-sm text-[#667391]">Abra um artigo para retomar sua leitura aqui, neste dispositivo.</p>}
    </div>
    {resume.error ? <Button variant="outline" size="sm" onClick={resume.retry}>Tentar novamente</Button> : resume.article ? <Button asChild variant="outline"><Link to={readingUrl(resume.article, resume.workspace)}>Continuar leitura →</Link></Button> : null}
  </section>;
}

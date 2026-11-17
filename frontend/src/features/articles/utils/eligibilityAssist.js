import { extractArticlePdfContent } from "@features/ai/public/pdf";
import { chatService } from "@/services/chatService";

export function normalizeChecklistStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["met", "atende", "sim", "yes", "included", "include"].includes(normalized)) {
    return "met";
  }
  if (["not_met", "nao_atende", "nao atende", "nao", "no", "excluded", "exclude"].includes(normalized)) {
    return "not_met";
  }
  if (["not_applicable", "na", "n/a", "not applicable"].includes(normalized)) {
    return "not_applicable";
  }
  if (["unclear", "incerto", "indefinido", "maybe", "unknown"].includes(normalized)) {
    return "unclear";
  }
  return "";
}

export function extractJsonPayload(text) {
  const normalized = String(text || "").trim();
  const fenceMatch = normalized.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenceMatch ? fenceMatch[1] : normalized;
  const objectMatch = candidate.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    return null;
  }

  try {
    return JSON.parse(objectMatch[0]);
  } catch {
    return null;
  }
}

/** Keep only valid, unique RQ numbers (1..count) from the AI answer. */
export function normalizeAnsweredRQs(value, count) {
  if (!Array.isArray(value) || !count) return [];
  const numbers = value.map((item) => {
    const raw = item && typeof item === "object" ? item.rq ?? item.number ?? item.id : item;
    const match = String(raw ?? "").match(/\d+/);
    return match ? Number(match[0]) : NaN;
  });
  return [...new Set(numbers.filter((number) => Number.isInteger(number) && number >= 1 && number <= count))]
    .sort((left, right) => left - right);
}

export function buildAssistancePrompt({ article, checklistEntries, researchQuestions }) {
  const checklistBlock = checklistEntries
    .map((entry, index) => `${index + 1}. ${entry.label} [key=${entry.key}]`)
    .join("\n");
  const rqBlock = researchQuestions.length
    ? researchQuestions.map((question, index) => `RQ ${index + 1}: ${question}`).join("\n")
    : "Nenhuma RQ cadastrada.";

  return `ELIGIBILITY_CHECKLIST_ASSIST
Voce esta apoiando a etapa de elegibilidade por texto completo. A decisao final deve continuar humana.

Tarefa:
1. Para cada item do checklist, procure evidencia no artigo.
2. Marque status como "met", "not_met", "unclear" ou "not_applicable".
3. Use evidencia literal curta quando houver. Nao invente evidencia.
4. Sugira uma decisao apenas como rascunho: "included", "excluded" ou "review".
5. Se faltar texto completo, use "unclear" e explique a limitacao.
6. Para cada pergunta de pesquisa (RQ), verifique se o artigo traz evidencia que ajude a responde-la. Liste em "answeredRQs" apenas as RQs com evidencia, pelo numero, com um trecho literal curto. Se nenhuma, use [].
7. Escreva "reasonText" citando os criterios que sustentam a decisao sugerida.

Checklist:
${checklistBlock}

Perguntas de pesquisa:
${rqBlock}

Artigo:
Titulo: ${article?.title || "Nao informado"}
Autores: ${article?.authors || "Nao informado"}
Ano: ${article?.year || "Nao informado"}
Resumo: ${article?.abstract || "Nao informado"}

Responda apenas em JSON neste formato:
{
  "items": [
    {
      "key": "item-1",
      "status": "met",
      "evidence": "trecho literal curto ou vazio",
      "note": "observacao curta"
    }
  ],
  "answeredRQs": [
    { "rq": 1, "evidence": "trecho literal curto" }
  ],
  "suggestedDecision": "included",
  "reasonText": "rascunho curto da justificativa"
}`;
}

async function readPdfText(pdfData) {
  if (!(pdfData instanceof ArrayBuffer)) return "";
  try {
    return (await extractArticlePdfContent(pdfData)).text;
  } catch (error) {
    console.warn("Nao foi possivel extrair texto do PDF:", error);
    return "";
  }
}

/**
 * Ask the AI for a draft of the eligibility checklist.
 * Returns { items: [{ key, status, evidence }], answeredRQs: [number], reasonText, suggestedDecision }.
 * Throws when the AI answer cannot be parsed, so callers can show a fallback message.
 */
export async function requestEligibilityAssist({ article, checklist, researchQuestions = [], pdfData }) {
  const content = await readPdfText(pdfData);
  const response = await chatService.sendChatMessage({
    messages: [{ role: "user", content: buildAssistancePrompt({ article, checklistEntries: checklist, researchQuestions }) }],
    article: {
      title: article?.title || "Artigo selecionado",
      abstract: article?.abstract,
      authors: article?.authors,
      year: article?.year,
      journal: article?.journal,
      doi: article?.doi,
      content,
    },
  });
  const parsed = extractJsonPayload(response?.content);
  if (!parsed) throw new Error("Resposta da IA sem estrutura JSON.");
  return {
    items: (parsed.items || []).map((item) => ({
      key: item.key,
      status: normalizeChecklistStatus(item.status) || "unclear",
      evidence: [item.evidence, item.note].map((value) => String(value || "").trim()).filter(Boolean).join("\n"),
    })),
    answeredRQs: normalizeAnsweredRQs(parsed.answeredRQs, researchQuestions.length),
    reasonText: typeof parsed.reasonText === "string" ? parsed.reasonText.trim() : "",
    suggestedDecision: parsed.suggestedDecision || "",
  };
}

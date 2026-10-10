import { useEffect, useRef, useState } from "react";
import { chatService } from "@services/chatService";
import { extractArticlePdfContent } from "./articlePdfContent";

function availableSource(article, pdfData, pdfState) {
  const hasAbstract = Boolean(article?.abstract?.trim());
  const fallback = hasAbstract ? "Resumo e metadados" : "Somente metadados";
  const fallbackDetail = hasAbstract
    ? "As respostas se limitam ao resumo disponível, não ao texto completo."
    : "Sem resumo ou texto extraído: não é possível verificar métodos e resultados do estudo.";
  if (pdfState.status === "ready" && pdfState.value?.text) {
    const value = pdfState.value;
    return { label: value.partial ? "PDF parcial" : "PDF extraído", loading: false,
      detail: `${value.pagesRead} de ${value.totalPages} páginas processadas, com limite de 8.000 caracteres.${hasAbstract ? " Resumo também disponível." : ""}` };
  }
  if (article?.hasPdf && pdfData && pdfState.status === "loading") {
    return { label: "Preparando texto do PDF", detail: "Aguarde a leitura para perguntar sobre o PDF.", loading: true };
  }
  return { label: fallback, loading: false,
    detail: pdfState.status === "error" ? `Não foi possível extrair o PDF. ${fallbackDetail}`
      : article?.hasPdf ? `Texto do PDF ainda indisponível. ${fallbackDetail}` : fallbackDetail };
}

function useArticleChat({ article, onAddNote, pdfData, enabled = true }) {
  const [pdfState, setPdfState] = useState({ status: "idle", value: null });
  const [pdfAttempt, setPdfAttempt] = useState(0);
  const [error, setError] = useState(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState([]);
  const scopeRef = useRef(0);
  const sendingRef = useRef(false);

  useEffect(() => {
    scopeRef.current += 1;
    sendingRef.current = false;
    setConversation([]);
    setInput("");
    setError(null);
    setIsLoading(false);
    setPdfState({ status: "idle", value: null });
    return () => { scopeRef.current += 1; };
  }, [article?.id]);

  useEffect(() => {
    if (!enabled) return;
    let ignore = false;
    setPdfState({ status: "idle", value: null });
    if (article?.hasPdf && pdfData) {
      setPdfState({ status: "loading", value: null });
      extractArticlePdfContent(pdfData).then((value) => {
        if (!ignore) setPdfState({ status: value.text ? "ready" : "error", value });
      }).catch(() => {
        if (!ignore) setPdfState({ status: "error", value: null });
      });
    }
    return () => { ignore = true; };
  }, [article?.id, article?.hasPdf, pdfData, pdfAttempt, enabled]);

  const source = availableSource(article, pdfData, pdfState);
  const messages = [
    { id: "welcome", role: "assistant", content: "Posso resumir este estudo, explicar conceitos e localizar evidências no material disponível. Vou distinguir interpretação de citação literal e sinalizar quando faltar informação. A decisão da revisão continua sendo sua." },
    ...conversation,
  ];

  async function handleSend(event, question = input) {
    event?.preventDefault();
    if (!question.trim() || sendingRef.current || source.loading || !article) return;
    const scope = scopeRef.current;
    const userMessage = { id: crypto.randomUUID(), role: "user", content: question.trim() };
    const nextMessages = [...conversation, userMessage];
    sendingRef.current = true;
    setConversation(nextMessages);
    setInput("");
    setIsLoading(true);
    setError(null);
    try {
      const data = await chatService.sendChatMessage({
        messages: nextMessages.map(({ role, content }) => ({ role, content })),
        article: { title: article.title, abstract: article.abstract, authors: article.authors,
          year: article.year, journal: article.journal, doi: article.doi, notas: article.notas,
          content: pdfState.status === "ready" ? pdfState.value.text : null,
          contentSource: source.label + (pdfState.status === "ready" ? `: ${source.detail}` : ""),
        },
      });
      if (!data?.content?.trim()) throw new Error("A IA retornou uma resposta vazia. Tente novamente.");
      if (scope !== scopeRef.current) return;
      setConversation((current) => [...current, { id: crypto.randomUUID(), role: "assistant",
        content: data.content, sourceLabel: source.label }]);
    } catch (sendError) {
      if (scope !== scopeRef.current) return;
      setError(sendError.message || "Não foi possível obter uma resposta.");
      setConversation((current) => current.filter((message) => message.id !== userMessage.id));
      setInput(userMessage.content);
    } finally {
      if (scope === scopeRef.current) {
        sendingRef.current = false;
        setIsLoading(false);
      }
    }
  }

  return { error, input, isLoading, messages, setInput, source,
    handleSend, retrySend: () => handleSend(),
    retryPdf: pdfState.status === "error" ? () => setPdfAttempt((value) => value + 1) : null,
    handleAddToNotes: (content) => onAddNote?.(content),
  };
}

export default useArticleChat;

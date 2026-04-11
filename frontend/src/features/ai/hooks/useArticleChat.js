import { useEffect, useState } from "react";
import { chatService } from "@services/chatService";

function buildWelcomeMessage({ article, articleContent, loadingContent, pdfData }) {
  let statusMessage = "";

  if (article?.hasPdf === false) {
    statusMessage = article?.abstract
      ? "Este artigo nÃ£o possui PDF. Posso ajudar com base no resumo e nos metadados disponÃ­veis."
      : "Este artigo nÃ£o possui PDF. Posso ajudar com os metadados cadastrados.";
  } else if (!pdfData) {
    statusMessage = "Aguardando carregamento do PDF...";
  } else if (loadingContent) {
    statusMessage = "Extraindo conteúdo do PDF...";
  } else if (articleContent) {
    statusMessage = "Conteúdo do PDF carregado com sucesso!";
  } else {
    statusMessage = "PDF carregado, mas conteúdo não disponível.";
  }

  return {
    id: "welcome",
    role: "assistant",
    content: `Olá! Sou seu assistente de pesquisa acadêmica. Estou analisando o artigo "${article.title}". ${statusMessage}\n\n${
      articleContent ? "Posso ajudar você com:" : "Aguarde o carregamento completo para:"
    }\n\n• Análise do conteúdo\n• Explicação de conceitos\n• Identificação de pontos-chave\n• Sugestões para suas notas\n\n${
      articleContent
        ? "Faça suas perguntas sobre o artigo!"
        : "O conteúdo será disponibilizado em breve."
    }`,
  };
}

async function extractPdfContent(pdfData) {
  if (!(pdfData instanceof ArrayBuffer)) {
    console.error("pdfData inválido:", typeof pdfData, pdfData);
    throw new Error("Dados do PDF inválidos");
  }

  const pdfjsLib = await import(
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.min.mjs"
  );

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.min.mjs";

  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdf = await loadingTask.promise;
  let extractedText = "";

  for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 10); pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(" ");

    extractedText += `${pageText}\n\n`;
  }

  return extractedText.length > 8000
    ? `${extractedText.substring(0, 8000)}...`
    : extractedText.trim();
}

function useArticleChat({ article, onAddNote, pdfData }) {
  const [articleContent, setArticleContent] = useState(null);
  const [error, setError] = useState(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    async function loadArticleContent() {
      if (!article || articleContent || !pdfData) {
        return;
      }

      setLoadingContent(true);

      try {
        const extractedText = await extractPdfContent(pdfData);
        setArticleContent(extractedText);
      } catch (loadError) {
        console.error("Erro ao extrair conteúdo do PDF:", loadError);
      } finally {
        setLoadingContent(false);
      }
    }

    loadArticleContent();
  }, [article, articleContent, pdfData]);

  useEffect(() => {
    if (!article || messages.length > 0) {
      return;
    }

    setMessages([
      buildWelcomeMessage({
        article,
        articleContent,
        loadingContent,
        pdfData,
      }),
    ]);
  }, [article, articleContent, loadingContent, messages.length, pdfData]);

  async function handleSend(event) {
    event?.preventDefault();

    if (!input.trim() || isLoading) {
      return;
    }

    const userMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const data = await chatService.sendChatMessage({
        messages: nextMessages,
        article: article
          ? {
              title: article.title,
              abstract: article.abstract,
              authors: article.authors,
              year: article.year,
              journal: article.journal,
              doi: article.doi,
              status: article.status,
              notas: article.notas,
              content: articleContent,
            }
          : null,
      });

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.content,
        },
      ]);
    } catch (sendError) {
      console.error("Erro:", sendError);
      setError(sendError.message);
      setMessages((currentMessages) => currentMessages.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }

  function handleAddToNotes(content) {
    if (onAddNote) {
      onAddNote(content);
    }
  }

  return {
    error,
    handleAddToNotes,
    handleSend,
    input,
    isLoading,
    messages,
    setInput,
  };
}

export default useArticleChat;

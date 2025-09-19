import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { PlusCircle, Send } from "lucide-react";
import { apiService } from "../services/api.js";

const ChatIA = ({ artigo, onAdicionarNota, pdfData }) => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [articleContent, setArticleContent] = useState(null);
  const [loadingContent, setLoadingContent] = useState(false);

  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const extractPdfContent = async () => {
      if (!artigo || articleContent || !pdfData) return;

      setLoadingContent(true);
      try {
        if (!(pdfData instanceof ArrayBuffer)) {
          console.error("pdfData inválido:", typeof pdfData, pdfData);
          throw new Error("Dados do PDF inválidos");
        }

        const pdfjsLib = await import(
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.min.mjs"
        );

        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.min.mjs";

        console.log(
          "Carregando PDF do ArrayBuffer, tamanho:",
          pdfData.byteLength
        );

        const loadingTask = pdfjsLib.getDocument({ data: pdfData });
        const pdf = await loadingTask.promise;

        const numPages = pdf.numPages;

        let extractedText = "";

        for (let pageNum = 1; pageNum <= Math.min(numPages, 10); pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();

          const pageText = textContent.items.map((item) => item.str).join(" ");
          extractedText += pageText + "\n\n";
        }

        const limitedText =
          extractedText.length > 8000
            ? extractedText.substring(0, 8000) + "..."
            : extractedText;

        setArticleContent(limitedText.trim());
      } catch (err) {
        console.error("Erro ao extrair conteúdo do PDF:", err);
      } finally {
        setLoadingContent(false);
      }
    };

    extractPdfContent();
  }, [artigo, articleContent, pdfData]);

  useEffect(() => {
    if (artigo && messages.length === 0) {
      let statusMessage = "";

      if (!pdfData) {
        statusMessage = "Aguardando carregamento do PDF...";
      } else if (loadingContent) {
        statusMessage = "Extraindo conteúdo do PDF...";
      } else if (articleContent) {
        statusMessage = "Conteúdo do PDF carregado com sucesso!";
      } else {
        statusMessage = "PDF carregado, mas conteúdo não disponível.";
      }

      const welcomeMessage = {
        id: "welcome",
        role: "assistant",
        content: `Olá! Sou seu assistente de pesquisa acadêmica. Estou analisando o artigo "${
          artigo.title
        }". ${statusMessage}\n\n${
          articleContent
            ? "Posso ajudar você com:"
            : "Aguarde o carregamento completo para:"
        }\n\n• Análise do conteúdo\n• Explicação de conceitos\n• Identificação de pontos-chave\n• Sugestões para suas notas\n\n${
          articleContent
            ? "Faça suas perguntas sobre o artigo!"
            : "O conteúdo será disponibilizado em breve."
        }`,
      };
      setMessages([welcomeMessage]);
    }
  }, [artigo, messages.length, loadingContent, pdfData, articleContent]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    try {
      const data = await apiService.post("/api/chat", {
        messages: [...messages, userMessage],
        artigo: artigo
          ? {
              title: artigo.title,
              abstract: artigo.abstract,
              authors: artigo.authors,
              year: artigo.year,
              journal: artigo.journal,
              doi: artigo.doi,
              status: artigo.status,
              notas: artigo.notas,
              content: articleContent,
            }
          : null,
      });

      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.content,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("Erro:", err);
      setError(err.message);
      // Remover a mensagem do assistente se houve erro
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 border bg-muted/50 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold mb-2">Assistente</h2>
      </div>

      <div
        className="flex-1 overflow-y-auto space-y-4 min-h-0 relative"
        ref={chatContainerRef}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            }`}
          >
            <div
              className={`rounded-xl relative px-4 py-2 max-w-[80%] whitespace-pre-wrap shadow-sm ${
                msg.role === "user"
                  ? "bg-background rounded-br-none"
                  : "bg-background rounded-bl-none border hover:pr-9 transition-all duration-200 group"
              }`}
            >
              <p className="text-sm">
                <strong>{msg.role}:</strong> {msg.content}
              </p>

              {msg.role === "assistant" && (
                <span
                  role="button"
                  tabIndex={0}
                  className="hidden group-hover:flex mt-2 h-7 w-7 text-gray-500 hover:text-black absolute right-2 top-0 cursor-pointer items-center justify-center"
                  onClick={() => onAdicionarNota(msg.content)}
                  title="Adicionar às notas do projeto"
                >
                  <PlusCircle className="h-4 w-4" />
                </span>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Respondendo...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <span className="text-red-700 text-sm">Erro: {error}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="flex gap-2 w-full items-end mt-4">
        <div className="flex-1">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            placeholder="Faça uma pergunta sobre pesquisa acadêmica..."
            className="resize-none max-h-20"
            rows={1}
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
          />
        </div>

        <Button
          type="submit"
          size="icon"
          className="w-10 h-10 flex-shrink-0"
          disabled={!input.trim() || isLoading}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};

export default ChatIA;

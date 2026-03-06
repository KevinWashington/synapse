import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Send } from "lucide-react";
import { apiService } from "@/services/api";
import ReactMarkdown from "react-markdown";

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
        content: `Olá! Sou seu assistente de pesquisa acadêmica. Estou analisando o artigo "${artigo.title
          }". ${statusMessage}\n\n${articleContent
            ? "Posso ajudar você com:"
            : "Aguarde o carregamento completo para:"
          }\n\n• Análise do conteúdo\n• Explicação de conceitos\n• Identificação de pontos-chave\n• Sugestões para suas notas\n\n${articleContent
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
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToNotes = (content) => {
    if (onAdicionarNota) {
      onAdicionarNota(content);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
        ref={chatContainerRef}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`relative max-w-[80%] ${msg.role === "assistant" ? "group/msg" : ""}`}>
              <div
                className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === "user"
                    ? "bg-[var(--syn-sidebar-bg)] text-white rounded-br-md"
                    : "bg-[var(--syn-bg-secondary)] border border-[var(--syn-border)] text-[var(--syn-text-primary)] rounded-bl-md"
                  }`}
              >
                {msg.role === "assistant" ? (
                  <div className="chat-markdown">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>

              {msg.role === "assistant" && msg.id !== "welcome" && (
                <button
                  type="button"
                  className="absolute -right-9 top-1 h-7 w-7 flex items-center justify-center rounded-full text-[var(--syn-text-secondary)] hover:text-[var(--syn-text-primary)] hover:bg-[var(--syn-badge-neutral-bg)] transition-all opacity-0 group-hover/msg:opacity-100 cursor-pointer"
                  onClick={() => handleAddToNotes(msg.content)}
                  title="Adicionar às notas"
                >
                  <PlusCircle className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[var(--syn-bg-secondary)] border border-[var(--syn-border)] rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--syn-text-secondary)] animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--syn-text-secondary)] animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--syn-text-secondary)] animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg p-3 bg-[var(--syn-badge-high-bg)] border border-pink-200">
            <span className="text-[var(--syn-badge-high-text)] text-sm">Erro: {error}</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-[var(--syn-border)] p-3">
        <form onSubmit={handleSend} className="flex items-end gap-2">
          <div className="flex-1">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              placeholder="Pergunte sobre o artigo..."
              className="resize-none max-h-20 rounded-xl border-[var(--syn-border)] bg-[var(--syn-bg-secondary)] text-sm"
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
            className="h-10 w-10 rounded-xl shrink-0"
            disabled={!input.trim() || isLoading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatIA;

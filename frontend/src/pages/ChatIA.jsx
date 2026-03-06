import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Bot, User, Loader2, BookOpen, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { apiService } from "@/services/api";
import { projectService } from "@/features/projects";
import ReactMarkdown from "react-markdown";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAIConfig } from "@/features/ai";
import { usePageTitle } from "@/context/pageTitleContext";
import { Link } from "react-router-dom";

function SourcesPanel({ sources, projectId }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-[var(--syn-border)] overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-[var(--syn-bg-secondary)] hover:bg-[var(--syn-bg-primary)] transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 text-[var(--syn-text-secondary)] flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-[var(--syn-text-secondary)] flex-shrink-0" />
        )}
        <BookOpen className="h-3 w-3 text-[var(--syn-text-secondary)] flex-shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--syn-text-secondary)]">
          Fontes ({sources.length} artigos)
        </span>
      </button>

      {isExpanded && (
        <div className="p-2 space-y-1 bg-[var(--syn-bg-secondary)]/50">
          {sources.map((source) => (
            <Link
              key={source.id}
              to={`/projetos/${projectId}/artigos/${source.id}`}
              className="flex items-start gap-2 p-1.5 rounded-md hover:bg-[var(--syn-bg-primary)] transition-colors group"
            >
              <FileText className="h-3 w-3 mt-0.5 text-[var(--syn-badge-blue-text)] flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--syn-text-primary)] group-hover:text-[var(--syn-badge-blue-text)] transition-colors truncate">
                  {source.title}
                </p>
                <p className="text-[10px] text-[var(--syn-text-secondary)]">
                  {source.authors && source.authors.length > 50
                    ? source.authors.substring(0, 50) + "..."
                    : source.authors}
                  {source.year ? ` (${source.year})` : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatIAPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Olá! Sou seu assistente de pesquisa acadêmica. Posso ajudar com análise de artigos, recomendações de leitura e insights sobre sua revisão literária.\n\nSelecione um projeto no painel ao lado para ativar o modo RAG e conversar com base nos artigos do projeto.",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);
  const { aiProvider, geminiConfig, ollamaConfig } = useAIConfig();

  const modelLabel =
    aiProvider === "gemini"
      ? geminiConfig.model || "Gemini"
      : ollamaConfig.model || "Ollama";

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await projectService.getAllProjects({ limit: 50 });
        setProjects(resp.projects || []);
      } catch (e) {
        console.error(e);
      }
    };
    load();
  }, []);

  // Reset messages when project changes
  useEffect(() => {
    const selectedProject = projects.find(
      (p) => p.id.toString() === selectedProjectId
    );

    if (selectedProject) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: `Projeto **"${selectedProject.title}"** selecionado! 🎯\n\nAgora estou no modo RAG — vou buscar automaticamente os artigos mais relevantes do projeto para responder suas perguntas.\n\nExperimente perguntar:\n- "Quais metodologias são usadas nos artigos?"\n- "Compare os resultados dos estudos"\n- "Quais lacunas existem na literatura?"`,
        },
      ]);
    } else {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content:
            "Olá! Sou seu assistente de pesquisa acadêmica. Posso ajudar com análise de artigos, recomendações de leitura e insights sobre sua revisão literária.\n\nSelecione um projeto no painel ao lado para ativar o modo RAG e conversar com base nos artigos do projeto.",
        },
      ]);
    }
  }, [selectedProjectId, projects]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      let data;

      if (selectedProjectId) {
        // RAG mode: use project-chat endpoint
        data = await projectService.chatWithProject(
          selectedProjectId,
          [...messages, userMsg]
        );
      } else {
        // Generic mode: use regular chat endpoint
        data = await apiService.post("/api/chat", {
          messages: [...messages, userMsg],
          artigo: null,
        });
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.content,
          sources: data.sources || [],
        },
      ]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Desculpe, ocorreu um erro ao processar sua mensagem. Verifique a configuração do provedor de IA.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  usePageTitle({ title: "Chat IA" });

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-4">
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Chat area */}
        <div className="flex-1 flex flex-col rounded-[var(--syn-radius-card)] bg-[var(--syn-bg-primary)] dark:bg-[var(--syn-bg-primary)] border border-[var(--syn-border)] overflow-hidden">
          {/* Messages */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${msg.role === "user"
                    ? "bg-[var(--syn-sidebar-bg)] text-white"
                    : "bg-[var(--syn-badge-blue-bg)]"
                    }`}
                >
                  {msg.role === "user" ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4 text-[var(--syn-badge-blue-text)]" />
                  )}
                </div>

                {/* Bubble + Sources */}
                <div className={`max-w-[75%]`}>
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === "user"
                      ? "bg-[var(--syn-sidebar-bg)] text-white rounded-tr-sm"
                      : "bg-[var(--syn-bg-secondary)] text-[var(--syn-text-primary)] rounded-tl-sm border border-[var(--syn-border)]"
                      }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <StatusBadge variant="blue" label={modelLabel} className="text-[10px] px-1.5 py-0" />
                        {selectedProjectId && msg.id !== "welcome" && (
                          <StatusBadge variant="green" label="RAG" className="text-[10px] px-1.5 py-0" />
                        )}
                      </div>
                    )}

                    {msg.role === "assistant" ? (
                      <div className="chat-markdown">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>

                  {/* Collapsible Sources */}
                  <SourcesPanel sources={msg.sources} projectId={selectedProjectId} />
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-[var(--syn-badge-blue-bg)] flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-[var(--syn-badge-blue-text)]" />
                </div>
                <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-[var(--syn-bg-secondary)] border border-[var(--syn-border)]">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-[var(--syn-text-secondary)]" />
                    <span className="text-xs text-[var(--syn-text-secondary)]">
                      {selectedProjectId ? "Buscando artigos relevantes..." : "Processando..."}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input bar */}
          <form
            onSubmit={handleSend}
            className="border-t border-[var(--syn-border)] p-3 flex gap-2"
          >
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                selectedProjectId
                  ? "Pergunte sobre os artigos do projeto..."
                  : "Digite sua pergunta..."
              }
              className="resize-none min-h-[40px] max-h-[120px]"
              rows={1}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="h-10 w-10 flex-shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>

        {/* Context sidebar */}
        <div className="hidden lg:flex flex-col w-[260px] rounded-[var(--syn-radius-card)] bg-[var(--syn-bg-primary)] dark:bg-[var(--syn-bg-primary)] border border-[var(--syn-border)] p-4 gap-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--syn-text-secondary)]">
            Contexto
          </h3>

          <div className="space-y-2">
            <label className="text-xs text-[var(--syn-text-secondary)]">
              Projeto ativo
            </label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-full text-xs">
                <SelectValue placeholder="Selecionar projeto" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProjectId && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <BookOpen className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Modo RAG ativo
                  </p>
                  <p className="text-[10px] text-[var(--syn-text-secondary)]">
                    Respostas baseadas nos artigos
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs text-[var(--syn-text-secondary)]">
              Modelo ativo
            </label>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--syn-bg-secondary)]">
              <Bot className="h-4 w-4 text-[var(--syn-badge-blue-text)]" />
              <div>
                <p className="text-xs font-medium text-[var(--syn-text-primary)]">
                  {aiProvider === "gemini" ? "Google Gemini" : "Ollama"}
                </p>
                <p className="text-[10px] text-[var(--syn-text-secondary)]">
                  {modelLabel}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatIAPage;

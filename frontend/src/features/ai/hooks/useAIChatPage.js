import { useCallback, useEffect, useMemo, useState } from "react";
import { chatService } from "@services/chatService";
import { projectService } from "@features/projects/services/projectService";
import { useAIConfig } from "@features/ai/context/AIConfigContext";

const DEFAULT_WELCOME_MESSAGE = {
  id: "welcome",
  role: "assistant",
  content:
    "Ola! Sou seu assistente de pesquisa academica. Posso ajudar com analise de artigos, recomendacoes de leitura e insights sobre sua revisao literaria.\n\nSelecione um projeto no painel ao lado para ativar o modo RAG e conversar com base nos artigos do projeto.",
};

function buildProjectWelcomeMessage(projectTitle) {
  return {
    id: "welcome",
    role: "assistant",
    content: `Projeto **"${projectTitle}"** selecionado!\n\nAgora estou no modo RAG e vou buscar automaticamente os artigos mais relevantes do projeto para responder suas perguntas.\n\nExperimente perguntar:\n- "Quais metodologias sao usadas nos artigos?"\n- "Compare os resultados dos estudos"\n- "Quais lacunas existem na literatura?"`,
  };
}

function useAIChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([DEFAULT_WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const { aiProvider, geminiConfig, ollamaConfig } = useAIConfig();

  const modelLabel = useMemo(
    () =>
      aiProvider === "gemini"
        ? geminiConfig.model || "Gemini"
        : ollamaConfig.model || "Ollama",
    [aiProvider, geminiConfig.model, ollamaConfig.model]
  );

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await projectService.getAllProjects({ limit: 50 });
        setProjects(response.projects || []);
      } catch (error) {
        console.error(error);
      }
    };

    loadProjects();
  }, []);

  useEffect(() => {
    const selectedProject = projects.find(
      (project) => project.id.toString() === selectedProjectId
    );

    setMessages([
      selectedProject
        ? buildProjectWelcomeMessage(selectedProject.title)
        : DEFAULT_WELCOME_MESSAGE,
    ]);
  }, [projects, selectedProjectId]);

  const handleSend = useCallback(
    async (event) => {
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

      try {
        const data = selectedProjectId
          ? await projectService.chatWithProject(selectedProjectId, nextMessages)
          : await chatService.sendChatMessage({
              messages: nextMessages,
              article: null,
            });

        setMessages((current) => [
          ...current,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: data.content,
            sources: data.sources || [],
          },
        ]);
      } catch (error) {
        console.error("Chat error:", error);
        setMessages((current) => [
          ...current,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content:
              "Desculpe, ocorreu um erro ao processar sua mensagem. Verifique a configuracao do provedor de IA.",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, messages, selectedProjectId]
  );

  return {
    aiProvider,
    handleSend,
    input,
    isLoading,
    messages,
    modelLabel,
    projects,
    selectedProjectId,
    setInput,
    setSelectedProjectId,
  };
}

export default useAIChatPage;


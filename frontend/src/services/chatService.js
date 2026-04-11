import { apiService } from "@/services/api";

async function sendChatMessage({ article = null, messages }) {
  return apiService.post("/api/chat", {
    messages,
    artigo: article,
  });
}

export const chatService = {
  sendChatMessage,
};

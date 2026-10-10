import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import useArticleChat from "./useArticleChat";

const transport = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@services/chatService", () => ({ chatService: { sendChatMessage: transport.send } }));

const article = { id: 1, title: "Estudo", abstract: "Método: entrevistas.", hasPdf: false };
beforeEach(() => { transport.send.mockReset(); });

describe("article assistant", () => {
  it("describes the available source without waiting for a nonexistent PDF", () => {
    const { result } = renderHook(() => useArticleChat({ article, pdfData: null }));
    expect(result.current.source.label).toBe("Resumo e metadados");
    expect(result.current.messages[0].content).not.toMatch(/Assim que/);
  });

  it("restores a failed question and allows retry without losing earlier conversation", async () => {
    transport.send.mockRejectedValueOnce(new Error("Sem conexão")).mockResolvedValueOnce({ content: "Resposta com evidência" });
    const { result } = renderHook(() => useArticleChat({ article, pdfData: null }));
    act(() => result.current.setInput("Qual é o método?"));
    await act(async () => result.current.handleSend());
    expect(result.current.input).toBe("Qual é o método?");
    expect(result.current.error).toBe("Sem conexão");
    await act(async () => result.current.retrySend());
    expect(result.current.messages.at(-1).content).toBe("Resposta com evidência");
    expect(result.current.messages.filter((item) => item.role === "user")).toHaveLength(1);
    expect(transport.send.mock.calls[1][0].article.contentSource).toBe("Resumo e metadados");
  });

  it("does not insert an old response into another article's conversation", async () => {
    let finish;
    transport.send.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const { result, rerender } = renderHook(({ current }) => useArticleChat({ article: current, pdfData: null }), {
      initialProps: { current: article },
    });
    act(() => result.current.setInput("Pergunta do estudo A"));
    let sending;
    act(() => { sending = result.current.handleSend(); });
    rerender({ current: { ...article, id: 2, title: "Estudo B" } });
    await act(async () => { finish({ content: "Resposta do estudo A" }); await sending; });
    await waitFor(() => expect(result.current.messages.some((item) => item.content === "Resposta do estudo A")).toBe(false));
  });
});

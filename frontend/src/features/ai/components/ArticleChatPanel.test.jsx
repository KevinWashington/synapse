import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import ArticleChatPanel from "./ArticleChatPanel";

const api = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@services/chatService", () => ({ chatService: { sendChatMessage: api.send } }));
beforeEach(() => { api.send.mockReset(); });
const article = { id: 1, title: "Estudo", abstract: "Método: entrevistas.", hasPdf: false };

it("shows the actual source and lets a suggested question be edited before sending", () => {
  render(<ArticleChatPanel article={article} />);
  expect(screen.getByText("Resumo e metadados")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Resumir estudo" }));
  expect(screen.getByRole("textbox", { name: "Pergunta ao assistente" }).value).toContain("Resuma");
  expect(api.send).not.toHaveBeenCalled();
});

it("announces that the assistant is preparing a response", async () => {
  let finish;
  api.send.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  render(<ArticleChatPanel article={article} />);
  fireEvent.change(screen.getByPlaceholderText("Pergunte sobre o artigo..."), { target: { value: "Resuma" } });
  fireEvent.keyDown(screen.getByPlaceholderText("Pergunte sobre o artigo..."), { key: "Enter" });
  expect(screen.getByRole("status")).toHaveTextContent("Preparando resposta");
  await act(async () => finish({ content: "Síntese do resumo" }));
});

it("offers a visible retry and retains the question after an error", async () => {
  api.send.mockRejectedValueOnce(new Error("Sem conexão")).mockResolvedValueOnce({ content: "Resposta recuperada" });
  render(<ArticleChatPanel article={article} />);
  fireEvent.change(screen.getByPlaceholderText("Pergunte sobre o artigo..."), { target: { value: "Explique o método" } });
  fireEvent.keyDown(screen.getByPlaceholderText("Pergunte sobre o artigo..."), { key: "Enter" });
  expect(await screen.findByRole("alert")).toHaveTextContent("Sem conexão");
  expect(screen.getByPlaceholderText("Pergunte sobre o artigo...")).toHaveValue("Explique o método");
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(await screen.findByText("Resposta recuperada")).toBeVisible();
});

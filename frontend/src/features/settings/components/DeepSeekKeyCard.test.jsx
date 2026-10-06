import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DeepSeekKeyCard from "./DeepSeekKeyCard";

describe("DeepSeekKeyCard", () => {
  it("explica que a chave e opcional quando nao configurada", () => {
    render(<DeepSeekKeyCard status={{ configured: false }} onSave={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText(/opcional/i)).toBeVisible();
    expect(screen.getByLabelText("Chave da API DeepSeek")).toHaveAttribute("type", "password");
  });

  it("permite revelar localmente e limpa o segredo depois de salvar", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<DeepSeekKeyCard status={{ configured: false }} onSave={onSave} onDelete={vi.fn()} />);
    const input = screen.getByLabelText("Chave da API DeepSeek");
    fireEvent.change(input, { target: { value: "sk-secret-value" } });
    fireEvent.click(screen.getByRole("button", { name: "Mostrar chave" }));
    expect(input).toHaveAttribute("type", "text");

    fireEvent.click(screen.getByRole("button", { name: "Salvar chave" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("sk-secret-value"));
    await waitFor(() => expect(input).toHaveValue(""));
    expect(input).toHaveAttribute("type", "password");
  });

  it("mostra somente o sufixo mascarado e confirma antes de remover", async () => {
    const onDelete = vi.fn().mockResolvedValue(true);
    render(
      <DeepSeekKeyCard
        status={{ configured: true, maskedKey: "••••1234", updatedAt: "2026-10-06T10:00:00Z" }}
        onSave={vi.fn()}
        onDelete={onDelete}
      />
    );

    expect(screen.getByText("••••1234")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Remover chave" }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar remoção" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
  });

  it("mostra erro de validacao sem apagar o valor para correcao", async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    render(
      <DeepSeekKeyCard
        status={{ configured: false }}
        error="A chave informada não foi aceita pela DeepSeek."
        onSave={onSave}
        onDelete={vi.fn()}
      />
    );
    const input = screen.getByLabelText("Chave da API DeepSeek");
    fireEvent.change(input, { target: { value: "invalid-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar chave" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("não foi aceita");
    expect(input).toHaveValue("invalid-key");
  });
});

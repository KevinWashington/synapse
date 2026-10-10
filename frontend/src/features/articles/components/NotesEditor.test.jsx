import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotesEditor from "./NotesEditor";

describe("notes autosave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("flushes an unsaved edit when leaving the editor", async () => {
    const saves = [];
    const { unmount } = render(<NotesEditor onSalvar={async (value) => saves.push(value)} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Observação importante" } });
    unmount();
    await act(async () => {});
    expect(saves).toEqual(["Observação importante"]);
  });

  it("keeps the draft and exposes retry after a save failure", async () => {
    let fail = true;
    const saves = [];
    render(<NotesEditor onSalvar={async (value) => {
      if (fail) throw new Error("offline");
      saves.push(value);
    }} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Não perder" } });
    await act(async () => vi.advanceTimersByTimeAsync(1500));
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível salvar");
    expect(screen.getByRole("textbox")).toHaveValue("Não perder");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await act(async () => {});
    expect(saves).toEqual(["Não perder"]);
    expect(screen.getByRole("status")).toHaveTextContent("Salvo");
  });

  it("does not replace newer typing with an earlier server acknowledgement", async () => {
    let resolveSave;
    const saves = [];
    const onSalvar = async (value) => {
      saves.push(value);
      if (saves.length === 1) await new Promise((resolve) => { resolveSave = resolve; });
    };
    const { rerender } = render(<NotesEditor valorInicial="Base" onSalvar={onSalvar} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Primeira versão" } });
    await act(async () => vi.advanceTimersByTimeAsync(1500));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Versão mais recente" } });
    rerender(<NotesEditor valorInicial="Primeira versão" onSalvar={onSalvar} />);
    expect(screen.getByRole("textbox")).toHaveValue("Versão mais recente");
    await act(async () => resolveSave());
    await act(async () => vi.advanceTimersByTimeAsync(1500));
    expect(saves).toEqual(["Primeira versão", "Versão mais recente"]);
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import GoogleSignInButton from "./GoogleSignInButton";

describe("GoogleSignInButton", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    delete window.google;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("inicializa e renderiza o botao oficial", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client.apps.googleusercontent.com");
    const initialize = vi.fn();
    const renderButton = vi.fn();
    const onCredential = vi.fn();
    render(<GoogleSignInButton onCredential={onCredential} />);

    window.google = { accounts: { id: { initialize, renderButton } } };
    fireEvent.load(document.querySelector('script[src="https://accounts.google.com/gsi/client"]'));

    await waitFor(() => expect(initialize).toHaveBeenCalledOnce());
    expect(renderButton).toHaveBeenCalledOnce();
    initialize.mock.calls[0][0].callback({ credential: "opaque-token" });
    expect(onCredential).toHaveBeenCalledWith("opaque-token");
  });

  it("mostra configuracao ausente sem tentar carregar o script", () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
    render(<GoogleSignInButton onCredential={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Google ainda nao configurado");
    expect(document.querySelector("script")).toBeNull();
  });

  it("oferece nova tentativa quando o script falha", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client.apps.googleusercontent.com");
    render(<GoogleSignInButton onCredential={vi.fn()} />);
    fireEvent.error(document.querySelector('script[src="https://accounts.google.com/gsi/client"]'));

    expect(await screen.findByText("Nao foi possivel carregar o login do Google.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeEnabled();
  });
});

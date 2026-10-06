import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authService } from "../services/authService";
import { useAuthProvider } from "./useAuthProvider";

vi.mock("../services/authService", () => ({
  authService: {
    restoreSession: vi.fn(),
    loginWithGoogle: vi.fn(),
    logout: vi.fn(),
    updateProfile: vi.fn(),
  },
}));

const user = {
  id: 7,
  name: "Ada Lovelace",
  email: "ada@example.com",
  role: "user",
};

describe("useAuthProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    authService.restoreSession.mockResolvedValue({ success: true, user });
  });

  it("restaura a sessao pelo cookie sem consultar armazenamento local", async () => {
    localStorage.setItem("token", "legacy-secret");
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const { result } = renderHook(() => useAuthProvider());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(authService.restoreSession).toHaveBeenCalledOnce();
    expect(result.current.user.email).toBe(user.email);
    expect(getItem).not.toHaveBeenCalled();
  });

  it("troca uma credencial Google por uma sessao e nao persiste tokens", async () => {
    authService.restoreSession.mockRejectedValue({ status: 401 });
    authService.loginWithGoogle.mockResolvedValue({ success: true, user });
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const { result } = renderHook(() => useAuthProvider());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let response;
    await act(async () => {
      response = await result.current.loginWithGoogle("google-id-token");
    });

    expect(response.success).toBe(true);
    expect(authService.loginWithGoogle).toHaveBeenCalledWith("google-id-token");
    expect(result.current.user.name).toBe(user.name);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("limpa o estado somente depois que o logout termina", async () => {
    let finishLogout;
    authService.logout.mockReturnValue(new Promise((resolve) => {
      finishLogout = resolve;
    }));
    const { result } = renderHook(() => useAuthProvider());
    await waitFor(() => expect(result.current.user).not.toBeNull());

    let logoutPromise;
    act(() => {
      logoutPromise = result.current.logout();
    });
    expect(result.current.user).not.toBeNull();

    await act(async () => {
      finishLogout();
      await logoutPromise;
    });
    expect(result.current.user).toBeNull();
  });
});

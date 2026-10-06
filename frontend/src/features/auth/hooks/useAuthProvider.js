import { useCallback, useEffect, useMemo, useState } from "react";
import { authService } from "@features/auth/services/authService";

const DEFAULT_USER_STATS = {
  totalProjects: 0,
  totalArticles: 0,
  totalArticlesReviewed: 0,
  textsReviewedToday: 0,
  textsToReview: 0,
  lastProjectCreated: 0,
};

function buildSessionUser(user) {
  return { ...user, stats: { ...DEFAULT_USER_STATS, ...(user.stats ?? {}) } };
}

function resolveErrorMessage(error, fallbackMessage) {
  return error.data?.message || error.message || fallbackMessage;
}

export function useAuthProvider() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    authService.restoreSession()
      .then((response) => {
        if (active && response?.success) setUser(buildSessionUser(response.user));
      })
      .catch((requestError) => {
        if (requestError?.status !== 401) console.error("Erro ao restaurar sessão:", requestError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const loginWithGoogle = useCallback(async (credential) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authService.loginWithGoogle(credential);
      if (!response?.success) throw new Error(response?.message || "Não foi possível entrar.");
      setUser(buildSessionUser(response.user));
      return { success: true };
    } catch (requestError) {
      const message = resolveErrorMessage(requestError, "Não foi possível entrar com o Google.");
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    try {
      await authService.logout();
      setUser(null);
      return { success: true };
    } catch (requestError) {
      const message = resolveErrorMessage(requestError, "Não foi possível encerrar a sessão.");
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const updateUser = useCallback(async (userData) => {
    try {
      const response = await authService.updateProfile(userData);
      if (!response?.success) throw new Error(response?.message || "Erro ao atualizar perfil.");
      setUser(buildSessionUser({ ...user, ...response.user }));
      return { success: true };
    } catch (requestError) {
      const message = resolveErrorMessage(requestError, "Erro ao atualizar perfil.");
      setError(message);
      return { success: false, error: message };
    }
  }, [user]);

  const isAuthenticated = useCallback(() => Boolean(user), [user]);

  return useMemo(() => ({
    user, loading, error, loginWithGoogle, logout, isAuthenticated, updateUser, setError,
  }), [user, loading, error, loginWithGoogle, logout, isAuthenticated, updateUser]);
}

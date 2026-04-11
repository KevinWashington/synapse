import { useCallback, useEffect, useMemo, useState } from "react";
import { authService } from "@features/auth/services/authService";

const AUTH_STORAGE_KEYS = {
  token: "token",
  user: "user",
};

const DEFAULT_USER_STATS = {
  totalProjects: 0,
  totalArticles: 0,
  totalArticlesReviewed: 0,
  textsReviewedToday: 0,
  textsToReview: 0,
  lastProjectCreated: 0,
};

function clearStoredSession() {
  localStorage.removeItem(AUTH_STORAGE_KEYS.user);
  localStorage.removeItem(AUTH_STORAGE_KEYS.token);
}

function getStoredSession() {
  const token = localStorage.getItem(AUTH_STORAGE_KEYS.token);
  const storedUser = localStorage.getItem(AUTH_STORAGE_KEYS.user);

  if (!token || !storedUser) {
    return { token: null, user: null };
  }

  try {
    return {
      token,
      user: JSON.parse(storedUser),
    };
  } catch {
    clearStoredSession();
    return { token: null, user: null };
  }
}

function buildSessionUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    lastLogin: user.lastLogin,
    stats: {
      ...DEFAULT_USER_STATS,
      ...(user.stats ?? {}),
    },
  };
}

function persistSession(user, token) {
  localStorage.setItem(AUTH_STORAGE_KEYS.user, JSON.stringify(user));
  localStorage.setItem(AUTH_STORAGE_KEYS.token, token);
}

function resolveErrorMessage(error, fallbackMessage) {
  return error.data?.message || error.message || fallbackMessage;
}

export function useAuthProvider() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const { token, user: storedUser } = getStoredSession();

        if (!token || !storedUser) {
          return;
        }

        const isValid = await authService.validateToken();

        if (!isMounted) {
          return;
        }

        if (isValid) {
          setUser(storedUser);
          return;
        }

        clearStoredSession();
      } catch (authError) {
        console.error("Erro ao verificar autenticação:", authError);
        clearStoredSession();
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    setLoading(true);
    setError(null);

    try {
      const response = await authService.login(credentials);

      if (!response.success) {
        const errorMessage = response.message || "Erro ao fazer login";
        setError(errorMessage);
        return { success: false, error: response.message };
      }

      const sessionUser = buildSessionUser(response.user);
      persistSession(sessionUser, response.token);
      setUser(sessionUser);

      return { success: true };
    } catch (requestError) {
      const errorMessage = resolveErrorMessage(
        requestError,
        "Erro interno do servidor"
      );

      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (userData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await authService.register(userData);

      if (!response.success) {
        const errorMessage = response.message || "Erro ao criar conta";
        setError(errorMessage);
        return { success: false, error: response.message };
      }

      const sessionUser = buildSessionUser(response.user);
      persistSession(sessionUser, response.token);
      setUser(sessionUser);

      return { success: true };
    } catch (requestError) {
      const errorMessage = resolveErrorMessage(
        requestError,
        "Erro interno do servidor"
      );

      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (logoutError) {
      console.error("Erro no logout:", logoutError);
    } finally {
      setUser(null);
      clearStoredSession();
    }
  }, []);

  const isAuthenticated = useCallback(() => !!user, [user]);

  const getToken = useCallback(
    () => localStorage.getItem(AUTH_STORAGE_KEYS.token),
    []
  );

  const updateUser = useCallback(
    async (userData) => {
      try {
        const response = await authService.updateProfile(userData);

        if (!response.success) {
          const errorMessage = response.message || "Erro ao atualizar perfil";
          setError(errorMessage);
          return { success: false, error: response.message };
        }

        const updatedUser = buildSessionUser({
          ...user,
          ...response.user,
          stats: {
            ...user?.stats,
            ...response.user?.stats,
          },
        });

        setUser(updatedUser);
        localStorage.setItem(
          AUTH_STORAGE_KEYS.user,
          JSON.stringify(updatedUser)
        );

        return { success: true };
      } catch (requestError) {
        const errorMessage = resolveErrorMessage(
          requestError,
          "Erro ao atualizar perfil"
        );

        setError(errorMessage);
        return { success: false, error: errorMessage };
      }
    },
    [user]
  );

  const changePassword = useCallback(async (passwordData) => {
    try {
      const response = await authService.changePassword(passwordData);

      if (!response.success) {
        const errorMessage = response.message || "Erro ao alterar senha";
        setError(errorMessage);
        return { success: false, error: response.message };
      }

      return { success: true };
    } catch (requestError) {
      const errorMessage = resolveErrorMessage(
        requestError,
        "Erro ao alterar senha"
      );

      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  return useMemo(
    () => ({
      user,
      loading,
      error,
      login,
      register,
      logout,
      isAuthenticated,
      getToken,
      updateUser,
      changePassword,
      setError,
    }),
    [
      user,
      loading,
      error,
      login,
      register,
      logout,
      isAuthenticated,
      getToken,
      updateUser,
      changePassword,
      setError,
    ]
  );
}

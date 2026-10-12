import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";

import { LoadingState } from "@components/layout";
import ProtectedRoute from "@components/ProtectedRoute";
import { Toaster } from "@components/ui/sonner";
import { AuthProvider } from "@features/auth";
import { toast } from "@/lib/toast";

const ArticleDetailsPage = lazy(() => import("@/pages/ArticleDetails"));
const ArticlesPage = lazy(() => import("@/pages/Articles"));
const AIChatPage = lazy(() => import("@/pages/AIChat"));
const SettingsPage = lazy(() => import("@/pages/Settings"));
const DashboardPage = lazy(() => import("@/pages/Dashboard"));
const LayoutPage = lazy(() => import("@/app/AppShell"));
const LoginPage = lazy(() => import("@/pages/Login"));
const ProjectDetailsPage = lazy(() => import("@/pages/ProjectDetails"));
const ProjectsPage = lazy(() => import("@/pages/Projects"));

function RouteLoader() {
  return <LoadingState message="Carregando página..." fullPage />;
}

function withSuspense(children) {
  return <Suspense fallback={<RouteLoader />}>{children}</Suspense>;
}

function App() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleMissingKey = () => {
      toast.warning("Configure sua chave DeepSeek para usar recursos de IA.", {
        id: "deepseek-key-required",
        action: { label: "Configurar", onClick: () => navigate("/settings") },
      });
    };
    window.addEventListener("synapse:deepseek-key-required", handleMissingKey);
    return () => window.removeEventListener("synapse:deepseek-key-required", handleMissingKey);
  }, [navigate]);

  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={withSuspense(<LoginPage />)} />
        <Route path="/register" element={<Navigate to="/login" replace />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              {withSuspense(<LayoutPage />)}
            </ProtectedRoute>
          }
        >
          <Route index element={withSuspense(<DashboardPage />)} />
          <Route path="dashboard" element={withSuspense(<DashboardPage />)} />
          <Route path="projetos" element={withSuspense(<ProjectsPage />)} />
          <Route
            path="projetos/:id"
            element={withSuspense(<ProjectDetailsPage />)}
          />
          <Route
            path="projetos/:projectId/artigos/:articleId"
            element={withSuspense(<ArticleDetailsPage />)}
          />

          <Route path="artigos" element={withSuspense(<ArticlesPage />)} />

          <Route path="ia/chat" element={withSuspense(<AIChatPage />)} />

          <Route path="settings" element={withSuspense(<SettingsPage />)} />
          <Route
            path="settings/preferencias"
            element={withSuspense(<SettingsPage />)}
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </AuthProvider>
  );
}

export default App;

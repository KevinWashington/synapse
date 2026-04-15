import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { LoadingState } from "@components/layout";
import ProtectedRoute from "@components/ProtectedRoute";
import { Toaster } from "@components/ui/Sonner";
import { AuthProvider } from "@features/auth";

const ArticleDetailsPage = lazy(() => import("@/pages/ArticleDetails"));
const ArticlesPage = lazy(() => import("@/pages/Articles"));
const AIChatPage = lazy(() => import("@/pages/AIChat"));
const SettingsPage = lazy(() => import("@/pages/Settings"));
const DashboardPage = lazy(() => import("@/pages/Dashboard"));
const LayoutPage = lazy(() => import("@/pages/Layout"));
const LoginPage = lazy(() => import("@/pages/Login"));
const ProjectDetailsPage = lazy(() => import("@/pages/ProjectDetails"));
const ProjectsPage = lazy(() => import("@/pages/Projects"));
const RegisterPage = lazy(() => import("@/pages/Register"));

function RouteLoader() {
  return <LoadingState message="Carregando página..." fullPage />;
}

function withSuspense(children) {
  return <Suspense fallback={<RouteLoader />}>{children}</Suspense>;
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={withSuspense(<LoginPage />)} />
        <Route path="/register" element={withSuspense(<RegisterPage />)} />

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
          <Route
            path="artigos/importar"
            element={withSuspense(<ArticlesPage />)}
          />
          <Route
            path="artigos/upload"
            element={withSuspense(<ArticlesPage />)}
          />

          <Route path="ia/analise" element={withSuspense(<AIChatPage />)} />
          <Route path="ia/recomendacoes" element={withSuspense(<AIChatPage />)} />
          <Route path="ia/chat" element={withSuspense(<AIChatPage />)} />

          <Route
            path="visualizacoes/relacionamentos"
            element={withSuspense(<DashboardPage />)}
          />
          <Route
            path="visualizacoes/estatisticas"
            element={withSuspense(<DashboardPage />)}
          />

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

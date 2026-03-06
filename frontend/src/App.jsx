import { Routes, Route, Navigate } from "react-router-dom";

// Features imports
import { LoginPage, RegisterPage, AuthProvider } from "./features/auth";
import { AIConfigProvider } from "./features/ai";

// Pages
import Dashboard from "./pages/Dashboard";
import Projetos from "./pages/Projetos";
import ProjetoDetalhes from "./pages/ProjetoDetalhes";
import ArtigoDetalhes from "./pages/ArtigoDetalhes";
import Layout from "./pages/Layout";
import Configuracoes from "./pages/Configuracoes";
import Artigos from "./pages/Artigos";
import ChatIAPage from "./pages/ChatIA";

// Components
import ProtectedRoute from "./components/ProtectedRoute";
import { Toaster } from "./components/ui/sonner";

function App() {
  return (
    <AuthProvider>
      <AIConfigProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="projetos" element={<Projetos />} />
            <Route path="projetos/:id" element={<ProjetoDetalhes />} />
            <Route
              path="projetos/:projetoId/artigos/:artigoId"
              element={<ArtigoDetalhes />}
            />

            {/* Articles */}
            <Route path="artigos" element={<Artigos />} />
            <Route path="artigos/importar" element={<Artigos />} />
            <Route path="artigos/upload" element={<Artigos />} />

            {/* AI */}
            <Route path="ia/analise" element={<ChatIAPage />} />
            <Route path="ia/recomendacoes" element={<ChatIAPage />} />
            <Route path="ia/chat" element={<ChatIAPage />} />

            {/* Visualizations */}
            <Route path="visualizacoes/relacionamentos" element={<Dashboard />} />
            <Route path="visualizacoes/estatisticas" element={<Dashboard />} />

            {/* Settings */}
            <Route path="configuracoes" element={<Configuracoes />} />
            <Route path="configuracoes/preferencias" element={<Configuracoes />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </AIConfigProvider>
    </AuthProvider>
  );
}

export default App;


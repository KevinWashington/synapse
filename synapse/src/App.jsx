import { Routes, Route, Navigate } from "react-router-dom";

// Features imports
import { LoginPage, RegisterPage, AuthProvider } from "./features/auth";
import { AIConfigProvider } from "./features/ai";

// Pages
import Dashboard from "./pages/Dashboard";
import Projetos from "./pages/Projetos";
import ProjetoDetalhes from "./pages/ProjetoDetalhes";
import ArtigoDetalhes from "./pages/ArtigoDetalhes";
import GrafoProject from "./pages/GrafoProject";
import Layout from "./pages/Layout";
import Configuracoes from "./pages/Configuracoes";

// Components
import ProtectedRoute from "./components/ProtectedRoute";

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
            <Route path="projetos" element={<Projetos />} />
            <Route path="projetos/:id" element={<ProjetoDetalhes />} />
            <Route
              path="projetos/:projetoId/grafo"
              element={<GrafoProject />}
            />
            <Route
              path="projetos/:projetoId/artigos/:artigoId"
              element={<ArtigoDetalhes />}
            />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="configuracoes" element={<Configuracoes />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AIConfigProvider>
    </AuthProvider>
  );
}

export default App;

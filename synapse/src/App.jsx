import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Projetos from "./pages/Projetos";
import ProjetoDetalhes from "./pages/ProjetoDetalhes";
import ArtigoDetalhes from "./pages/ArtigoDetalhes";
import GrafoProject from "./pages/GrafoProject";
import Layout from "./pages/Layout";
import Perfil from "./pages/Perfil";
import Configuracoes from "./pages/Configuracoes";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthProvider from "./context/authContext.jsx";
import { AIConfigProvider } from "./context/aiConfigContext.jsx";
import { Routes, Route, Navigate } from "react-router-dom";

function App() {
  return (
    <AuthProvider>
      <AIConfigProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

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
            <Route path="perfil" element={<Perfil />} />
            <Route path="configuracoes" element={<Configuracoes />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AIConfigProvider>
    </AuthProvider>
  );
}

export default App;

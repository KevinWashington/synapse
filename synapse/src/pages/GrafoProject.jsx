import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import GrafoRelacionamentos from "../components/GrafoRelacionamentos";

function GrafoProject() {
  const { projetoId } = useParams();
  const navigate = useNavigate();

  const handleNodeClick = (node) => {
    navigate(`/projetos/${projetoId}/artigos/${node.id}`);
  };

  return (
    <div className="min-h-screen flex flex-col space-y-4">
      <GrafoRelacionamentos
        projetoId={projetoId}
        onNodeClick={handleNodeClick}
      />
    </div>
  );
}

export default GrafoProject;

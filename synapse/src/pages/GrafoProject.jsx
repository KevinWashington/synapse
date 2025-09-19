import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { ArrowLeftIcon } from "lucide-react";
import GrafoRelacionamentos from "../components/GrafoRelacionamentos";

function GrafoProject() {
  const { projetoId } = useParams();
  const navigate = useNavigate();

  const handleNodeClick = (node) => {
    navigate(`/projetos/${projetoId}/artigos/${node.id}`);
  };

  return (
    <div className="min-h-screen flex flex-col space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Synapses</h1>

      <GrafoRelacionamentos
        projetoId={projetoId}
        onNodeClick={handleNodeClick}
      />
    </div>
  );
}

export default GrafoProject;

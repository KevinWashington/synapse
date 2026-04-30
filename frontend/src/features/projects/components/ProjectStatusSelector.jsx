import { memo } from "react";


const PROJECT_STATUSES = ["ideia", "em-progresso", "concluido", "pausado"];

function ProjectStatusSelector({ value, onChange }) {
  const getStatusLabel = (s) => {
    switch(s) {
      case "ideia": return "Ideia";
      case "em-progresso": return "Em Progresso";
      case "concluido": return "Concluido";
      case "pausado": return "Pausado";
      default: return s;
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {PROJECT_STATUSES.map((status) => (
        <button
          key={status}
          type="button"
          onClick={() => onChange(status)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            value === status
              ? "bg-[#6259ff] text-white border-transparent"
              : "border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          {getStatusLabel(status)}
        </button>
      ))}
    </div>
  );
}

export default memo(ProjectStatusSelector);



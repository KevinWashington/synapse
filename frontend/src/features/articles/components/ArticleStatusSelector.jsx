import { Label } from "@/components/ui/Label";


function ArticleStatusSelector({
  label = "Status",
  onChange,
  options,
  selectedStatus,
}) {
  const getStatusLabel = (s) => {
    switch(s) {
      case "pendente": return "Pendente";
      case "analisado": return "Analisado";
      case "excluido": return "Excluido";
      case "incluido": return "Incluido";
      case "lendo": return "Lendo";
      default: return s;
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => onChange(status)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedStatus === status
                ? "border-transparent bg-[#6259ff] text-white"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {getStatusLabel(status)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ArticleStatusSelector;

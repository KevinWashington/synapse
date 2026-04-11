import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

function ArticlePublicationFields({ fieldPrefix, formData, onFieldChange }) {
  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${fieldPrefix}-pages`}>Páginas</Label>
          <Input
            id={`${fieldPrefix}-pages`}
            value={formData.pages}
            onChange={(event) => onFieldChange("pages", event.target.value)}
            placeholder="1-6"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${fieldPrefix}-volume`}>Volume</Label>
          <Input
            id={`${fieldPrefix}-volume`}
            value={formData.volume}
            onChange={(event) => onFieldChange("volume", event.target.value)}
            placeholder="45"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${fieldPrefix}-number`}>Número</Label>
          <Input
            id={`${fieldPrefix}-number`}
            value={formData.number}
            onChange={(event) => onFieldChange("number", event.target.value)}
            placeholder="2"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${fieldPrefix}-issn`}>ISSN</Label>
          <Input
            id={`${fieldPrefix}-issn`}
            value={formData.issn}
            onChange={(event) => onFieldChange("issn", event.target.value)}
            placeholder="2770-0682"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${fieldPrefix}-keywords`}>Palavras-chave</Label>
          <Input
            id={`${fieldPrefix}-keywords`}
            value={formData.keywords}
            onChange={(event) => onFieldChange("keywords", event.target.value)}
            placeholder="palavra1, palavra2"
          />
        </div>
      </div>
    </>
  );
}

export default ArticlePublicationFields;

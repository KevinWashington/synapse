import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";

function FieldError({ error }) {
  if (!error) {
    return null;
  }

  return <p className="text-sm text-red-500">{error}</p>;
}

function Counter({ currentLength, maxLength }) {
  return (
    <p className="text-xs text-[var(--syn-text-secondary)]">
      {currentLength}/{maxLength} caracteres
    </p>
  );
}

function ArticleCommonFields({
  currentYear,
  errors = {},
  fieldPrefix,
  formData,
  journalLabel,
  onFieldChange,
  placeholders,
  requiredFields = false,
  showCounters = false,
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${fieldPrefix}-title`}>
          Título {requiredFields ? <span className="text-red-500">*</span> : null}
        </Label>
        <Input
          id={`${fieldPrefix}-title`}
          value={formData.title}
          onChange={(event) => onFieldChange("title", event.target.value)}
          placeholder={placeholders.title}
          className={errors.title ? "border-red-500" : ""}
          maxLength={200}
        />
        <FieldError error={errors.title} />
        {showCounters ? (
          <Counter currentLength={formData.title.length} maxLength={200} />
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${fieldPrefix}-authors`}>
          Autores {requiredFields ? <span className="text-red-500">*</span> : null}
        </Label>
        <Input
          id={`${fieldPrefix}-authors`}
          value={formData.authors}
          onChange={(event) => onFieldChange("authors", event.target.value)}
          placeholder={placeholders.authors}
          className={errors.authors ? "border-red-500" : ""}
          maxLength={300}
        />
        <FieldError error={errors.authors} />
        {showCounters ? (
          <Counter currentLength={formData.authors.length} maxLength={300} />
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${fieldPrefix}-year`}>
            Ano {requiredFields ? <span className="text-red-500">*</span> : null}
          </Label>
          <Input
            id={`${fieldPrefix}-year`}
            type="number"
            min={1900}
            max={currentYear + 1}
            value={formData.year}
            onChange={(event) => onFieldChange("year", event.target.value)}
            placeholder={placeholders.year}
            className={errors.year ? "border-red-500" : ""}
          />
          <FieldError error={errors.year} />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${fieldPrefix}-journal`}>
            {journalLabel}{" "}
            {requiredFields ? <span className="text-red-500">*</span> : null}
          </Label>
          <Input
            id={`${fieldPrefix}-journal`}
            value={formData.journal}
            onChange={(event) => onFieldChange("journal", event.target.value)}
            placeholder={placeholders.journal}
            className={errors.journal ? "border-red-500" : ""}
            maxLength={200}
          />
          <FieldError error={errors.journal} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${fieldPrefix}-doi`}>
          DOI{" "}
          <span className="text-xs text-[var(--syn-text-secondary)]">
            (opcional)
          </span>
        </Label>
        <Input
          id={`${fieldPrefix}-doi`}
          value={formData.doi}
          onChange={(event) => onFieldChange("doi", event.target.value)}
          placeholder={placeholders.doi}
          className={errors.doi ? "border-red-500" : ""}
          maxLength={50}
        />
        <FieldError error={errors.doi} />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${fieldPrefix}-abstract`}>
          Resumo{" "}
          <span className="text-xs text-[var(--syn-text-secondary)]">
            (opcional)
          </span>
        </Label>
        <Textarea
          id={`${fieldPrefix}-abstract`}
          value={formData.abstract}
          onChange={(event) => onFieldChange("abstract", event.target.value)}
          placeholder={placeholders.abstract}
          className={errors.abstract ? "border-red-500" : ""}
          rows={4}
          maxLength={3000}
        />
        <FieldError error={errors.abstract} />
        {showCounters ? (
          <Counter currentLength={formData.abstract.length} maxLength={3000} />
        ) : null}
      </div>
    </>
  );
}

export default ArticleCommonFields;

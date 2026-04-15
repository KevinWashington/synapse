import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";

function ThemePreferenceCard({ onThemeColorChange, themeColor, themeColorOptions }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferências Gerais</CardTitle>
        <CardDescription>Escolha a cor principal da interface.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          A cor escolhida é aplicada em destaques, gráficos e elementos de navegação.
        </p>
        <div className="flex flex-wrap gap-2">
          {themeColorOptions.map((option) => {
            const isActive = themeColor === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onThemeColorChange(option.value)}
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "border-[var(--syn-sidebar-accent)] bg-[var(--syn-bg-secondary)] text-[var(--syn-text-primary)]"
                    : "border-[var(--syn-border)] text-[var(--syn-text-secondary)] hover:bg-[var(--syn-bg-secondary)]"
                }`}
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: option.accent }}
                />
                {option.label}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default ThemePreferenceCard;

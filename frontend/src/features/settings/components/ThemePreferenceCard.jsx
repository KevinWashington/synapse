import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";

function ThemePreferenceCard({ isDark, onToggleTheme }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferências Gerais</CardTitle>
        <CardDescription>Personalize o tema da interface.</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-foreground">Tema Escuro</h3>
            <p className="text-sm text-muted-foreground">
              Alternar para modo escuro
            </p>
          </div>

          <input
            type="checkbox"
            className="h-4 w-4 text-primary"
            checked={isDark}
            onChange={onToggleTheme}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default ThemePreferenceCard;

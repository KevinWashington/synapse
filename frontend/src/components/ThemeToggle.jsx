import { Button } from "@/components/ui/Button";
import useThemePreference from "@hooks/useThemePreference";
import { Moon, Sun } from "lucide-react";

function ThemeToggle({ className = "" }) {
  const { isDark, toggleTheme } = useThemePreference();

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className={className}
      title={`Alternar para tema ${isDark ? "claro" : "escuro"}`}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

export default ThemeToggle;

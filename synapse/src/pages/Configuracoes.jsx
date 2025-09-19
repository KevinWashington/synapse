import { Button } from "@/components/ui/button";

function Configuracoes() {
  const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains("dark");

    if (isDark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }
  };

  const isDark = document.documentElement.classList.contains("dark");
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-foreground mb-6">Configurações</h1>

      <div className="space-y-6">
        <div className="bg-card rounded-lg shadow border p-6">
          <h2 className="text-xl font-semibold text-card-foreground mb-4">
            Preferências Gerais
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-foreground">
                  Notificações
                </h3>
                <p className="text-sm text-muted-foreground">
                  Receber notificações do sistema
                </p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4 text-primary"
                defaultChecked
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-foreground">
                  Tema Escuro
                </h3>
                <p className="text-sm text-muted-foreground">
                  Alternar para modo escuro
                </p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4 text-primary"
                checked={isDark}
                onChange={toggleTheme}
              />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg shadow border p-6">
          <h2 className="text-xl font-semibold text-card-foreground mb-4">
            Segurança
          </h2>
          <div className="space-y-4">
            <Button>Alterar Senha</Button>
            <Button variant="secondary">Configurar 2FA</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Configuracoes;

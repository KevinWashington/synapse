function Perfil() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-foreground mb-6">Perfil</h1>

      <div className="bg-card rounded-lg shadow border p-6">
        <h2 className="text-xl font-semibold text-card-foreground mb-4">
          Informações do Usuário
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground">
              Nome
            </label>
            <p className="mt-1 text-sm text-card-foreground">
              Usuário do Sistema
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">
              Email
            </label>
            <p className="mt-1 text-sm text-card-foreground">
              usuario@exemplo.com
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">
              Cargo
            </label>
            <p className="mt-1 text-sm text-card-foreground">Administrador</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Perfil;

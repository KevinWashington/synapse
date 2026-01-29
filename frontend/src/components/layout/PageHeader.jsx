import { cn } from "@/lib/utils";

/**
 * PageHeader - Header consistente para todas as páginas
 * @param {string} title - Título principal da página
 * @param {string} description - Descrição opcional
 * @param {ReactNode} actions - Botões de ação à direita
 * @param {ReactNode} children - Conteúdo adicional (filtros, etc)
 */
function PageHeader({ title, description, actions, children, className }) {
    return (
        <div className={cn("space-y-4", className)}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{title}</h1>
                    {description && (
                        <p className="text-muted-foreground mt-1">{description}</p>
                    )}
                </div>
                {actions && (
                    <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
                )}
            </div>
            {children}
        </div>
    );
}

export default PageHeader;

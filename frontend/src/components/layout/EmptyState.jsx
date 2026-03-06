import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

/**
 * EmptyState - Componente para estados vazios reutilizável
 * @param {ReactNode} icon - Ícone a ser exibido
 * @param {string} title - Título do estado vazio
 * @param {string} description - Descrição explicativa
 * @param {string} actionLabel - Label do botão de ação
 * @param {function} onAction - Callback do botão
 * @param {ReactNode} actions - Botões customizados (substitui actionLabel/onAction)
 */
function EmptyState({
    icon: Icon,
    title,
    description,
    actionLabel,
    onAction,
    actions,
    className,
}) {
    return (
        <div className={cn("text-center py-12", className)}>
            {Icon && (
                <div className="flex justify-center mb-4">
                    <Icon className="h-12 w-12 text-[var(--syn-text-secondary)]" />
                </div>
            )}
            <h3 className="text-lg font-medium text-[var(--syn-text-primary)] mb-2">{title}</h3>
            {description && (
                <p className="text-[var(--syn-text-secondary)] mb-4 max-w-md mx-auto">
                    {description}
                </p>
            )}
            {actions ? (
                <div className="flex gap-2 justify-center">{actions}</div>
            ) : (
                actionLabel &&
                onAction && (
                    <Button onClick={onAction} className="mx-auto">
                        {actionLabel}
                    </Button>
                )
            )}
        </div>
    );
}

export default EmptyState;

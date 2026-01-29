import { cn } from "@/lib/utils";

/**
 * PageContainer - Container padrão com espaçamento consistente
 * @param {ReactNode} children - Conteúdo da página
 * @param {string} className - Classes adicionais
 * @param {string} size - "default" | "narrow" | "wide"
 */
function PageContainer({ children, className, size = "default" }) {
    const sizeClasses = {
        narrow: "max-w-4xl",
        default: "max-w-7xl",
        wide: "max-w-full",
    };

    return (
        <div className={cn("space-y-6", sizeClasses[size], className)}>
            {children}
        </div>
    );
}

export default PageContainer;

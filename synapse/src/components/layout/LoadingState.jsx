import { LoaderIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * LoadingState - Componente de loading consistente
 * @param {string} message - Mensagem de loading
 * @param {string} size - "sm" | "md" | "lg"
 * @param {boolean} fullPage - Se ocupa a página inteira
 */
function LoadingState({
    message = "Carregando...",
    size = "md",
    fullPage = false,
    className,
}) {
    const sizeClasses = {
        sm: "h-4 w-4",
        md: "h-6 w-6",
        lg: "h-8 w-8",
    };

    const content = (
        <div className={cn("flex items-center justify-center gap-2", className)}>
            <LoaderIcon className={cn("animate-spin text-primary", sizeClasses[size])} />
            {message && <span className="text-muted-foreground">{message}</span>}
        </div>
    );

    if (fullPage) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                {content}
            </div>
        );
    }

    return <div className="py-8">{content}</div>;
}

export default LoadingState;

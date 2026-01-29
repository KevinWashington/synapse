import { Card, CardHeader, CardTitle, CardDescription, CardAction } from "../ui/card";
import { cn } from "@/lib/utils";

/**
 * StatCard - Card de estatística reutilizável
 * @param {string} title - Título/label da estatística
 * @param {string|number} value - Valor da estatística
 * @param {ReactNode} icon - Ícone do card
 * @param {string} trend - Texto de tendência (ex: "+12% desde ontem")
 * @param {boolean} loading - Se está carregando
 */
function StatCard({ title, value, icon: Icon, trend, loading, className }) {
    return (
        <Card className={cn("@container/card", className)}>
            <CardHeader>
                <CardDescription>{title}</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                    {loading ? "..." : value}
                </CardTitle>
                {Icon && (
                    <CardAction>
                        <Icon className="h-6 w-6 text-green-500" />
                    </CardAction>
                )}
            </CardHeader>
            {trend && (
                <div className="px-6 pb-4">
                    <span className="text-xs text-muted-foreground">{trend}</span>
                </div>
            )}
        </Card>
    );
}

export default StatCard;

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function ReviewsChartCard({ chartData }) {
  return (
    <div className="rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] p-5 shadow-[var(--syn-shadow-card)] dark:bg-[var(--syn-bg-primary)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--syn-text-primary)]">
            Artigos por Semana
          </h3>
          <p className="text-xs text-[var(--syn-text-secondary)]">
            Período atual vs anterior
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--syn-chart-current)]" />
            <span className="text-[var(--syn-text-secondary)]">Período Atual</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--syn-chart-previous)]" />
            <span className="text-[var(--syn-text-secondary)]">Período Anterior</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="fillCurrent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--syn-chart-current)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--syn-chart-current)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fillPrevious" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--syn-chart-previous)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="var(--syn-chart-previous)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--syn-border)" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--syn-text-secondary)", fontSize: 11 }}
            tickFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
            }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--syn-text-secondary)", fontSize: 11 }}
            width={30}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--syn-bg-primary)",
              border: "1px solid var(--syn-border)",
              borderRadius: "var(--syn-radius-card)",
              fontSize: 12,
            }}
            labelFormatter={(value) =>
              new Date(value).toLocaleDateString("pt-BR", {
                day: "numeric",
                month: "long",
              })
            }
          />
          <Area
            type="monotone"
            dataKey="previous"
            stroke="var(--syn-chart-previous)"
            fill="url(#fillPrevious)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="current"
            stroke="var(--syn-chart-current)"
            fill="url(#fillCurrent)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ReviewsChartCard;

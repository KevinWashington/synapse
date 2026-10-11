import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { CHART_COLORS } from "../../utils/projectAnalytics";
function EmptyChart({ children, compact = false }) {
  return (
    <div className={cn(
      "flex h-full items-center justify-center rounded-lg bg-[#f8f9fc] text-center text-sm text-[#667391]",
      compact ? "min-h-[118px] px-3 text-xs" : "min-h-[180px]"
    )}>
      {children}
    </div>
  );
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return "0%";
  }
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function PublicationYearChart({ data }) {
  if (!data.length) {
    return <EmptyChart>Nenhum ano de publicação informado.</EmptyChart>;
  }

  return (
    <div className="h-[230px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -18, right: 6, top: 12 }}>
          <CartesianGrid stroke="#f0f2f8" vertical={false} />
          <XAxis dataKey="year" tick={{ fill: "#56627f", fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: "#56627f", fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: "#f6f7ff" }} />
          <Bar isAnimationActive={false} dataKey="value" fill="#8178ff" radius={[4, 4, 0, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StudyTypeChart({ data, total }) {
  if (!data.length) {
    return <EmptyChart>Nenhum tipo de estudo classificado.</EmptyChart>;
  }

  return (
    <div className="grid min-h-[230px] items-center gap-4 @min-[360px]:grid-cols-[170px_minmax(0,1fr)]">
      <div className="relative mx-auto h-[170px] w-[170px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie isAnimationActive={false} data={data} dataKey="value" innerRadius={52} outerRadius={80} paddingAngle={2}>
              {data.map((item, index) => (
                <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold text-[#111936]">{formatNumber(total)}</span>
          <span className="text-xs text-[#667391]">artigos</span>
        </div>
      </div>
      <div className="space-y-3">
        {data.slice(0, 6).map((item, index) => (
          <div key={item.name} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex min-w-0 items-center gap-2 text-[#253252]">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
              />
              <span className="truncate">{item.name}</span>
            </span>
            <span className="shrink-0 text-[#56627f]">
              {formatNumber(item.value)} ({formatPercent((item.value / total) * 100)})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SourceChart({ data, total }) {
  if (!data.length) {
    return <EmptyChart>Nenhuma fonte registrada.</EmptyChart>;
  }

  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const width = total ? Math.max((item.value / total) * 100, 2) : 0;
        return (
          <div key={item.name} className="grid grid-cols-[110px_1fr_82px] items-center gap-3 text-xs">
            <span className="truncate font-medium text-[#253252]">{item.name}</span>
            <div className="h-3 overflow-hidden rounded-full bg-[#eef1ff]">
              <div
                className="h-full rounded-full"
                style={{
                  backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                  width: `${width}%`,
                }}
              />
            </div>
            <span className="text-right text-[#56627f]">
              {formatNumber(item.value)} ({formatPercent((item.value / total) * 100)})
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function KeywordCloud({ data }) {
  if (!data.length) {
    return <EmptyChart>Nenhuma palavra-chave registrada.</EmptyChart>;
  }

  const max = Math.max(...data.map((item) => item.count), 1);

  return (
    <div className="flex min-h-[190px] flex-wrap items-center justify-center gap-x-5 gap-y-3 px-4 py-2 text-center">
      {data.map((item, index) => {
        const size = 13 + Math.round((item.count / max) * 18);
        return (
          <span
            key={item.text}
            className="font-semibold leading-none"
            style={{
              color: CHART_COLORS[index % CHART_COLORS.length],
              fontSize: `${size}px`,
            }}
          >
            {item.text}
          </span>
        );
      })}
    </div>
  );
}

export function StatusChart({ data, total }) {
  if (!data.length) {
    return <EmptyChart>Nenhum status para exibir.</EmptyChart>;
  }

  return (
    <div className="grid min-h-[190px] items-center gap-4 @min-[360px]:grid-cols-[155px_minmax(0,1fr)]">
      <div className="relative mx-auto h-[155px] w-[155px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie isAnimationActive={false} data={data} dataKey="value" innerRadius={47} outerRadius={72} startAngle={90} endAngle={450}>
              {data.map((item) => (
                <Cell key={item.key} fill={item.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold text-[#111936]">{formatNumber(total)}</span>
          <span className="text-xs text-[#667391]">artigos</span>
        </div>
      </div>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-2 text-[#253252]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="text-[#56627f]">
              {formatNumber(item.value)} ({formatPercent((item.value / total) * 100)})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendChart({ data }) {
  if (!data.length) {
    return <EmptyChart>Sem eventos suficientes para montar tendências.</EmptyChart>;
  }

  return (
    <div className="h-[230px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: -18, right: 8, top: 10 }}>
          <CartesianGrid stroke="#f0f2f8" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#56627f", fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: "#56627f", fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip />
          <Line isAnimationActive={false} type="monotone" dataKey="Identificados" stroke="#6259ff" strokeWidth={2} dot={{ r: 2 }} />
          <Line isAnimationActive={false} type="monotone" dataKey="Incluídos" stroke="#49c987" strokeWidth={2} dot={{ r: 2 }} />
          <Line isAnimationActive={false} type="monotone" dataKey="Publicações" stroke="#5a86ff" strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

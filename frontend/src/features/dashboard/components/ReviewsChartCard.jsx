import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function formatDay(value) {
  return new Date(value).toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" });
}

function ReviewsChartCard({ chartData, loading, error, embedded = false }) {
  const gradientId = `dashboard-analysis-${useId().replaceAll(":", "")}`;
  const hasData = chartData.some((day) => day.count > 0);
  return (
    <section aria-label="Análises recentes" className={embedded ? "min-w-0 border-t border-[#edf0f7]" : "min-w-0 rounded-xl border border-[#e2e6ef] bg-white"}>
      <header className="p-4 pb-0 sm:p-5 sm:pb-0"><h2 className="text-sm font-semibold tracking-[-0.02em] text-[#111936]">Análises nos seus projetos</h2><p className="mt-1 text-xs text-[#667391]">Artigos analisados nos últimos dias, em toda a conta.</p></header>
      <div className="min-w-0 p-4 sm:p-5">
        {loading ? <p role="status" className="py-8 text-center text-sm text-[#667391]">Carregando análises...</p>
          : error ? <p className="py-8 text-center text-sm text-[#667391]">Gráfico indisponível enquanto os indicadores não forem carregados.</p>
          : !hasData ? <p className="py-8 text-center text-sm text-[#667391]">Nenhum artigo analisado nas datas exibidas.</p>
          : <ResponsiveContainer width="100%" height={embedded ? 120 : 180}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6259ff" stopOpacity={0.18} /><stop offset="95%" stopColor="#6259ff" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f7" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#667391", fontSize: 11 }} tickFormatter={formatDay} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#667391", fontSize: 11 }} width={32} />
              <Tooltip contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e2e6ef", borderRadius: 8, fontSize: 12 }} labelFormatter={formatDay} />
              <Area name="Artigos analisados" type="linear" dataKey="count" stroke="#6259ff" fill={`url(#${gradientId})`} strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>}
        {!loading && !error && hasData && <>
          <table className="sr-only" aria-label="Artigos analisados por data">
            <thead><tr><th scope="col">Data (UTC)</th><th scope="col">Artigos analisados</th></tr></thead>
            <tbody>{chartData.map((day) => <tr key={day.date}><th scope="row">{formatDay(day.date)}</th><td>{day.count}</td></tr>)}</tbody>
          </table>
          <p className="mt-3 text-xs leading-5 text-[#667391]">Por data da última atualização (UTC). Considera os artigos com status analisado.</p>
        </>}
      </div>
    </section>
  );
}

export default ReviewsChartCard;

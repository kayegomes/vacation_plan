import { AlertTriangle, ArrowUpRight, CalendarClock, FileSpreadsheet, ShieldCheck, Users } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";

type SummaryCardProps = {
  label: string;
  value: number | string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "green" | "gold" | "coral" | "slate";
};

const toneStyles = {
  green: "bg-[#e6eee5] text-[#23604b]",
  gold: "bg-[#f4ecd5] text-[#8c641d]",
  coral: "bg-[#f9e5df] text-[#9d4737]",
  slate: "bg-[#e8ecea] text-[#40594f]",
};

function SummaryCard({ label, value, description, icon: Icon, tone }: SummaryCardProps) {
  return (
    <article className="group rounded-3xl border border-[#dce1da] bg-white p-5 shadow-[0_8px_24px_rgba(37,58,48,0.04)] transition-transform duration-200 hover:-translate-y-0.5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#718078]">{label}</p>
          <p className="mt-4 font-display text-5xl leading-none text-[#173f35]">{value}</p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${toneStyles[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-5 text-sm leading-5 text-[#66736c]">{description}</p>
    </article>
  );
}

export default function Home() {
  const summaryQuery = trpc.dashboard.summary.useQuery(undefined, { retry: false });
  const summary = summaryQuery.data;
  const fallbackSummary = {
    activeEmployees: 0,
    pendingRequests: 0,
    expiringCycles: 0,
    negativeBalanceCycles: 0,
    openAlerts: 0,
    conflictAlerts: 0,
  };
  const displaySummary = summary ?? fallbackSummary;
  const hasData = displaySummary.activeEmployees > 0;

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <header className="flex flex-col gap-6 border-b border-[#dce1da] pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#65766d]">
            <span className="h-2 w-2 rounded-full bg-[#4d8768]" aria-hidden="true" />
            Central de planejamento
          </div>
          <h1 className="mt-3 font-display text-4xl leading-none text-[#173f35] sm:text-5xl">Visão geral</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#617067] sm:text-base">Uma leitura confiável do que precisa de atenção antes que o calendário vire um problema operacional.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/importacao" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#b9c6ba] bg-white px-4 text-sm font-semibold text-[#173f35] transition-colors hover:bg-[#eef2ed]">
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            Importar planilha
          </Link>
          <Link href="/equipe" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#173f35] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0f3027]">
            Cadastrar colaborador
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Indicadores do planejamento">
        {summaryQuery.isLoading ? (
          Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="rounded-3xl border border-[#dce1da] bg-white p-5 sm:p-6" aria-label="Carregando indicador">
              <Skeleton className="h-3 w-24 bg-[#e6eee5]" />
              <Skeleton className="mt-5 h-11 w-16 bg-[#edf2eb]" />
              <Skeleton className="mt-6 h-4 w-full bg-[#edf2eb]" />
            </div>
          ))
        ) : (
          <>
            <SummaryCard label="Colaboradores ativos" value={summary ? displaySummary.activeEmployees : "—"} description="Cadastros disponíveis para planejamento." icon={Users} tone="green" />
            <SummaryCard label="Solicitações pendentes" value={summary ? displaySummary.pendingRequests : "—"} description="Períodos aguardando decisão de aprovação." icon={CalendarClock} tone="gold" />
            <SummaryCard label="Vencimentos em 90 dias" value={summary ? displaySummary.expiringCycles : "—"} description="Ciclos que pedem planejamento antecipado." icon={AlertTriangle} tone="coral" />
            <SummaryCard label="Saldos negativos" value={summary ? displaySummary.negativeBalanceCycles : "—"} description="Ciclos que exigem conferência e justificativa." icon={AlertTriangle} tone="coral" />
            <SummaryCard label="Alertas em aberto" value={summary ? displaySummary.openAlerts : "—"} description={displaySummary.conflictAlerts ? `${displaySummary.conflictAlerts} relacionado(s) a conflito.` : "Sem conflitos registrados neste momento."} icon={ShieldCheck} tone="slate" />
          </>
        )}
      </section>

      <section className="mt-7 grid gap-5 xl:grid-cols-[1.55fr_0.95fr]">
        <article className="rounded-3xl border border-[#dce1da] bg-white p-6 shadow-[0_8px_24px_rgba(37,58,48,0.04)] sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#65766d]">Próximo passo recomendado</p>
              <h2 className="mt-3 font-display text-3xl leading-tight text-[#173f35]">{hasData ? "Revise o planejamento que exige decisão." : "Traga a base de férias para um fluxo confiável."}</h2>
            </div>
            <span className="w-fit rounded-full bg-[#e6eee5] px-3 py-1.5 text-xs font-semibold text-[#23604b]">{hasData ? "Acompanhamento ativo" : "Ambiente pronto"}</span>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#617067]">
            {hasData
              ? "Use o calendário consolidado para conferir sobreposições, validar cobertura de grupos e encaminhar solicitações para aprovação."
              : "Comece pela importação assistida do Excel. A carga será apresentada em prévia, com pendências separadas para revisão antes da publicação."}
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {[
              ["1", "Estruturar", "Cargos, grupos, bases e colaboradores."],
              ["2", "Conferir", "Ciclos, saldos, vencimentos e exceções."],
              ["3", "Planejar", "Períodos, conflitos e aprovações."],
            ].map(([step, title, text]) => (
              <div key={step} className="rounded-2xl bg-[#f5f7f3] p-4">
                <span className="font-display text-2xl text-[#4d8768]">{step}</span>
                <p className="mt-3 text-sm font-semibold text-[#173f35]">{title}</p>
                <p className="mt-1 text-xs leading-5 text-[#66736c]">{text}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="overflow-hidden rounded-3xl bg-[#173f35] p-6 text-white shadow-[0_12px_30px_rgba(23,63,53,0.16)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#bad0bd]">Princípio do sistema</p>
          <blockquote className="mt-4 font-display text-3xl leading-tight text-[#f7f4e8]">“Uma única fonte para decidir, registrar e acompanhar.”</blockquote>
          <div className="mt-8 border-t border-white/15 pt-5">
            <p className="text-sm leading-6 text-[#c6d5c7]">A arquitetura já contempla ciclos, períodos, saldos, exceções, aprovação, auditoria, alertas e histórico de execuções. A interface será entregue em módulos validados.</p>
            <Link href="/planejamento" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#e8d8a9] hover:text-white">
              Abrir planejamento
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </article>
      </section>

      {summaryQuery.isError && (
        <p className="mt-5 rounded-xl border border-[#f0c1b6] bg-[#fff5f2] px-4 py-3 text-sm text-[#8f3c2c]">Os indicadores não puderam ser atualizados agora. Você ainda pode navegar pelo ambiente enquanto a conexão é restabelecida.</p>
      )}
    </div>
  );
}

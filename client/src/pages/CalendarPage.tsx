import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { getConflictDays, getEntriesForDay } from "@/lib/calendarUtils";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, FilterX } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

type PeriodStatus = "draft" | "requested" | "approved" | "rejected" | "cancelled" | "completed";
const statusLabels: Record<PeriodStatus, string> = { draft: "Rascunho", requested: "Em aprovação", approved: "Aprovado", rejected: "Rejeitado", cancelled: "Cancelado", completed: "Concluído" };
const statusColors: Record<PeriodStatus, string> = { draft: "bg-[#adb8b0]", requested: "bg-[#d6ac47]", approved: "bg-[#4d8768]", rejected: "bg-[#ce7869]", cancelled: "bg-[#a6afb0]", completed: "bg-[#4b8d8d]" };

function firstOfMonth(value: string) { return new Date(`${value}-01T00:00:00Z`); }
function monthInputValue(date: Date) { return date.toISOString().slice(0, 7); }
function daysInMonth(date: Date) { return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate(); }
function allMonthDays(date: Date) { return Array.from({ length: daysInMonth(date) }, (_, index) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), index + 1))); }
function dateInputValue(date: Date) { return date.toISOString().slice(0, 10); }

export default function CalendarPage() {
  const initialMonth = monthInputValue(new Date());
  const [month, setMonth] = useState(initialMonth);
  const [jobRoleId, setJobRoleId] = useState("");
  const [operationalGroupId, setOperationalGroupId] = useState("");
  const [baseId, setBaseId] = useState("");
  const [status, setStatus] = useState("");
  const monthDate = useMemo(() => firstOfMonth(month), [month]);
  const days = useMemo(() => allMonthDays(monthDate), [monthDate]);
  const filterInput = useMemo(() => ({
    startDate: dateInputValue(days[0]),
    endDate: dateInputValue(days[days.length - 1]),
    jobRoleId: jobRoleId ? Number(jobRoleId) : undefined,
    operationalGroupId: operationalGroupId ? Number(operationalGroupId) : undefined,
    baseId: baseId ? Number(baseId) : undefined,
    status: status ? status as PeriodStatus : undefined,
  }), [days, jobRoleId, operationalGroupId, baseId, status]);
  const entriesQuery = trpc.calendar.list.useQuery(filterInput);
  const exportCalendar = trpc.exports.calendar.useMutation();
  const rolesQuery = trpc.organization.list.useQuery("jobRole");
  const groupsQuery = trpc.organization.list.useQuery("operationalGroup");
  const basesQuery = trpc.organization.list.useQuery("base");
  const entries = entriesQuery.data ?? [];
  const conflictDays = useMemo(() => getConflictDays(entries, days), [entries, days]);
  const conflictStamps = useMemo(() => new Set(conflictDays.map(day => dateInputValue(day))), [conflictDays]);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(monthDate);

  function changeMonth(amount: number) { setMonth(monthInputValue(new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + amount, 1)))); }
  function clearFilters() { setJobRoleId(""); setOperationalGroupId(""); setBaseId(""); setStatus(""); }
  function downloadExport(format: "xlsx" | "csv") {
    exportCalendar.mutate({ ...filterInput, format }, {
      onSuccess: file => {
        const binary = atob(file.fileBase64);
        const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: file.contentType }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = file.filename;
        anchor.click();
        URL.revokeObjectURL(url);
      },
    });
  }

  return (
    <div className="mx-auto max-w-[1440px]">
      <header className="flex flex-col gap-6 border-b border-[#dce1da] pb-7 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#65766d]">Cobertura operacional</p><h1 className="mt-3 font-display text-4xl leading-none text-[#173f35] sm:text-5xl">Calendário consolidado</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#617067] sm:text-base">Visualize períodos planejados por dia, filtre estruturas e identifique ausências simultâneas com as pessoas envolvidas.</p></div><Link href="/planejamento" className="inline-flex h-11 items-center justify-center rounded-xl bg-[#173f35] px-4 text-sm font-semibold text-white hover:bg-[#0f3027]">Abrir planejamento</Link></header>

      <section className="mt-6 rounded-3xl border border-[#dce1da] bg-white p-5 shadow-[0_8px_24px_rgba(37,58,48,0.04)] sm:p-6"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"><label className="text-sm font-semibold text-[#334c40]">Mês<input type="month" value={month} onChange={event => setMonth(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#cfd8d0] bg-white px-3 text-sm font-normal outline-none ring-[#4d8768] focus:ring-2" /></label><label className="text-sm font-semibold text-[#334c40]">Cargo<select value={jobRoleId} onChange={event => setJobRoleId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#cfd8d0] bg-white px-3 text-sm font-normal outline-none ring-[#4d8768] focus:ring-2"><option value="">Todos</option>{(rolesQuery.data ?? []).map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label><label className="text-sm font-semibold text-[#334c40]">Grupo<select value={operationalGroupId} onChange={event => setOperationalGroupId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#cfd8d0] bg-white px-3 text-sm font-normal outline-none ring-[#4d8768] focus:ring-2"><option value="">Todos</option>{(groupsQuery.data ?? []).map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><label className="text-sm font-semibold text-[#334c40]">Base<select value={baseId} onChange={event => setBaseId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#cfd8d0] bg-white px-3 text-sm font-normal outline-none ring-[#4d8768] focus:ring-2"><option value="">Todas</option>{(basesQuery.data ?? []).map(base => <option key={base.id} value={base.id}>{base.name}</option>)}</select></label><label className="text-sm font-semibold text-[#334c40]">Status<select value={status} onChange={event => setStatus(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#cfd8d0] bg-white px-3 text-sm font-normal outline-none ring-[#4d8768] focus:ring-2"><option value="">Todos</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><div className="mt-5 flex flex-col gap-3 border-t border-[#edf0ec] pt-5 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-2 text-sm text-[#617067]"><CalendarDays className="h-4 w-4 text-[#315f4d]" />{entries.length} período(s) no recorte · {conflictDays.length} dia(s) com sobreposição</div><div className="flex flex-col gap-2 sm:flex-row"><Button variant="outline" onClick={() => downloadExport("csv")} disabled={exportCalendar.isPending} className="h-10 rounded-xl border-[#cfd8d0] bg-white text-[#315f4d] hover:bg-[#eef2ed]">Exportar CSV</Button><Button variant="outline" onClick={() => downloadExport("xlsx")} disabled={exportCalendar.isPending} className="h-10 rounded-xl border-[#cfd8d0] bg-white text-[#315f4d] hover:bg-[#eef2ed]">Exportar Excel</Button><Button variant="outline" onClick={clearFilters} className="h-10 rounded-xl border-[#cfd8d0] bg-white text-[#315f4d] hover:bg-[#eef2ed]"><FilterX className="mr-2 h-4 w-4" />Limpar filtros</Button></div></div>{exportCalendar.isError && <p className="mt-4 text-sm text-[#a14332]">{exportCalendar.error.message}</p>}</section>

      <section className="mt-7 rounded-3xl border border-[#dce1da] bg-white shadow-[0_8px_24px_rgba(37,58,48,0.04)]"><div className="flex flex-col gap-4 border-b border-[#e3e8e2] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#718078]">Agenda mensal</p><h2 className="mt-2 font-display text-3xl capitalize text-[#173f35]">{label}</h2></div><div className="flex gap-2"><Button variant="outline" size="icon" onClick={() => changeMonth(-1)} className="rounded-xl border-[#cfd8d0] bg-white text-[#315f4d] hover:bg-[#eef2ed]" aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" onClick={() => changeMonth(1)} className="rounded-xl border-[#cfd8d0] bg-white text-[#315f4d] hover:bg-[#eef2ed]" aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></Button></div></div>{entriesQuery.isLoading ? <div className="space-y-3 p-6">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-12 w-full bg-[#edf2eb]" />)}</div> : entriesQuery.isError ? <div className="p-8 text-sm text-[#a14332]">Não foi possível carregar o calendário para este recorte.</div> : entries.length === 0 ? <div className="px-6 py-16 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e6eee5] text-[#23604b]"><CalendarDays className="h-6 w-6" /></span><p className="mt-5 font-display text-2xl text-[#173f35]">Sem períodos neste recorte.</p><p className="mt-2 text-sm text-[#66736c]">Ajuste os filtros, altere o mês ou crie um período para começar a visualizar a cobertura.</p></div> : <div className="overflow-x-auto"><div className="min-w-[1180px]"><div className="grid border-b border-[#e3e8e2] bg-[#fafbf9]" style={{ gridTemplateColumns: `250px repeat(${days.length}, minmax(28px, 1fr))` }}><div className="sticky left-0 z-10 bg-[#fafbf9] px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#718078]">Colaborador</div>{days.map(day => <div key={dateInputValue(day)} className={`border-l border-[#edf0ec] py-2 text-center text-xs ${conflictStamps.has(dateInputValue(day)) ? "bg-[#fff4ed] text-[#9d4737]" : "text-[#718078]"}`}><p className="font-semibold">{day.getUTCDate()}</p><p className="mt-0.5 text-[9px] uppercase">{new Intl.DateTimeFormat("pt-BR", { weekday: "narrow", timeZone: "UTC" }).format(day)}</p></div>)}</div>{entries.map(entry => <div key={entry.id} className="grid border-b border-[#edf0ec] last:border-b-0" style={{ gridTemplateColumns: `250px repeat(${days.length}, minmax(28px, 1fr))` }}><div className="sticky left-0 z-10 bg-white px-5 py-4"><p className="text-sm font-semibold text-[#173f35]">{entry.employeeName}</p><p className="mt-1 text-xs text-[#718078]">{entry.jobRoleName || "Sem cargo"} · {entry.baseName || "Sem base"}</p></div>{days.map(day => { const activeEntries = getEntriesForDay([entry], day); const isActive = activeEntries.length > 0; const dayEntries = getEntriesForDay(entries, day); const isConflict = dayEntries.length > 1; return <div key={dateInputValue(day)} title={isConflict ? `Sobreposição: ${dayEntries.map(item => item.employeeName).join(", ")}` : isActive ? `${entry.employeeName} · ${statusLabels[entry.status as PeriodStatus]}` : undefined} className={`relative min-h-16 border-l border-[#f0f2ef] ${isConflict ? "bg-[#fffaf6]" : ""}`}>{isActive && <span className={`absolute inset-x-1 top-4 h-7 rounded-md ${statusColors[entry.status as PeriodStatus]} ${isConflict ? "ring-2 ring-[#e6a080] ring-offset-1" : ""}`} />}</div>; })}</div>)}</div></div>}</section>

      {conflictDays.length > 0 && <section className="mt-6 rounded-3xl border border-[#f0c1b6] bg-[#fff7f3] p-6"><div className="flex items-start gap-3"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#f9e5df] text-[#9d4737]"><AlertTriangle className="h-4 w-4" /></span><div><p className="font-semibold text-[#75382c]">Sobreposições identificadas neste recorte</p><p className="mt-1 text-sm leading-6 text-[#8b5144]">{conflictDays.slice(0, 6).map(day => `${new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(day)}: ${getEntriesForDay(entries, day).map(entry => entry.employeeName).join(" e ")}`).join(" · ")}{conflictDays.length > 6 ? " · …" : ""}</p></div></div></section>}
    </div>
  );
}

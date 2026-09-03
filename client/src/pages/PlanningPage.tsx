import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { CalendarDays, Check, CircleAlert, FilePlus2, Pencil, Plus, Send, X } from "lucide-react";
import React from "react";
import { FormEvent, useMemo, useState } from "react";
import { Link } from "wouter";

type PeriodStatus = "draft" | "requested" | "approved" | "rejected" | "cancelled" | "completed";

const statusLabels: Record<PeriodStatus, string> = {
  draft: "Rascunho",
  requested: "Em aprovação",
  approved: "Aprovado",
  rejected: "Rejeitado",
  cancelled: "Cancelado",
  completed: "Concluído",
};

const statusStyles: Record<PeriodStatus, string> = {
  draft: "bg-[#edf0ec] text-[#536159]",
  requested: "bg-[#f7efd8] text-[#85601d]",
  approved: "bg-[#e3efe4] text-[#23604b]",
  rejected: "bg-[#f9e5df] text-[#9d4737]",
  cancelled: "bg-[#edf0ec] text-[#66736c]",
  completed: "bg-[#e1eeee] text-[#2b6060]",
};

function formatDate(value: Date | string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

function calculateDays(startDate: string, endDate: string) {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const days = Math.floor((end.valueOf() - start.valueOf()) / 86_400_000) + 1;
  return days > 0 ? days : null;
}

export default function PlanningPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const employeesQuery = trpc.employees.list.useQuery();
  const cyclesQuery = trpc.vacations.cycles.useQuery();
  const periodsQuery = trpc.vacations.periods.useQuery();
  const [showCycleForm, setShowCycleForm] = useState(false);
  const [showPeriodForm, setShowPeriodForm] = useState(false);
  const [editingCycleId, setEditingCycleId] = useState<number | null>(null);
  const [editingPeriodId, setEditingPeriodId] = useState<number | null>(null);
  const [cycleForm, setCycleForm] = useState({ employeeId: "", reference: "", accrualStartDate: "", accrualEndDate: "", expirationDate: "", entitledDays: "30", soldDays: "0", adjustmentDays: "0", exceptionJustification: "" });
  const [periodForm, setPeriodForm] = useState({ employeeId: "", vacationCycleId: "", startDate: "", endDate: "", status: "draft" as "draft" | "requested", exceptionJustification: "" });
  const canPlan = user?.role === "planner" || user?.role === "admin";
  const canApprove = user?.role === "approver" || user?.role === "admin";
  const employees = employeesQuery.data ?? [];
  const cycles = cyclesQuery.data ?? [];
  const periods = periodsQuery.data ?? [];
  const calculatedDays = calculateDays(periodForm.startDate, periodForm.endDate);

  const availableCycles = useMemo(
    () => cycles.filter(cycle => !periodForm.employeeId || cycle.employeeId === Number(periodForm.employeeId)),
    [cycles, periodForm.employeeId],
  );

  const refreshPlanning = async () => {
    await Promise.all([
      utils.vacations.cycles.invalidate(),
      utils.vacations.periods.invalidate(),
      utils.dashboard.summary.invalidate(),
    ]);
  };

  const createCycle = trpc.vacations.createCycle.useMutation({
    onSuccess: async () => {
      await refreshPlanning();
      setCycleForm({ employeeId: "", reference: "", accrualStartDate: "", accrualEndDate: "", expirationDate: "", entitledDays: "30", soldDays: "0", adjustmentDays: "0", exceptionJustification: "" });
      setShowCycleForm(false);
    },
  });
  const createPeriod = trpc.vacations.createPeriod.useMutation({
    onSuccess: async () => {
      await refreshPlanning();
      setPeriodForm({ employeeId: "", vacationCycleId: "", startDate: "", endDate: "", status: "draft", exceptionJustification: "" });
      setShowPeriodForm(false);
    },
  });
  const updateCycle = trpc.vacations.updateCycle.useMutation({
    onSuccess: async () => {
      await refreshPlanning();
      setCycleForm({ employeeId: "", reference: "", accrualStartDate: "", accrualEndDate: "", expirationDate: "", entitledDays: "30", soldDays: "0", adjustmentDays: "0", exceptionJustification: "" });
      setEditingCycleId(null);
      setShowCycleForm(false);
    },
  });
  const updatePeriod = trpc.vacations.updatePeriod.useMutation({
    onSuccess: async () => {
      await refreshPlanning();
      setPeriodForm({ employeeId: "", vacationCycleId: "", startDate: "", endDate: "", status: "draft", exceptionJustification: "" });
      setEditingPeriodId(null);
      setShowPeriodForm(false);
    },
  });
  const sendForApproval = trpc.vacations.sendForApproval.useMutation({ onSuccess: refreshPlanning });
  const decide = trpc.vacations.decide.useMutation({ onSuccess: refreshPlanning });
  const cancel = trpc.vacations.cancel.useMutation({ onSuccess: refreshPlanning });
  const complete = trpc.vacations.complete.useMutation({ onSuccess: refreshPlanning });

  function submitCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      employeeId: Number(cycleForm.employeeId),
      reference: cycleForm.reference,
      accrualStartDate: cycleForm.accrualStartDate || undefined,
      accrualEndDate: cycleForm.accrualEndDate || undefined,
      expirationDate: cycleForm.expirationDate,
      entitledDays: Number(cycleForm.entitledDays),
      soldDays: Number(cycleForm.soldDays),
      adjustmentDays: Number(cycleForm.adjustmentDays),
      exceptionJustification: cycleForm.exceptionJustification || undefined,
    };
    if (editingCycleId) updateCycle.mutate({ ...payload, vacationCycleId: editingCycleId }); else createCycle.mutate(payload);
  }

  function submitPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      employeeId: Number(periodForm.employeeId),
      vacationCycleId: Number(periodForm.vacationCycleId),
      startDate: periodForm.startDate,
      endDate: periodForm.endDate,
      status: periodForm.status,
      exceptionJustification: periodForm.exceptionJustification || undefined,
    };
    if (editingPeriodId) updatePeriod.mutate({ ...payload, vacationPeriodId: editingPeriodId }); else createPeriod.mutate(payload);
  }

  function handleDecision(id: number, toStatus: "approved" | "rejected") {
    const comment = toStatus === "rejected" ? window.prompt("Informe o motivo da rejeição:") : "Período aprovado.";
    if (toStatus === "rejected" && !comment?.trim()) return;
    decide.mutate({ vacationPeriodId: id, toStatus, comment: comment || undefined });
  }

  function handleCancellation(id: number) {
    const comment = window.prompt("Informe o motivo do cancelamento:");
    if (!comment?.trim()) return;
    cancel.mutate({ vacationPeriodId: id, toStatus: "cancelled", comment });
  }

  function startCycleEdit(cycle: typeof cycles[number]) {
    setEditingCycleId(cycle.id);
    setCycleForm({ employeeId: String(cycle.employeeId), reference: cycle.reference, accrualStartDate: cycle.accrualStartDate ? new Date(cycle.accrualStartDate).toISOString().slice(0, 10) : "", accrualEndDate: cycle.accrualEndDate ? new Date(cycle.accrualEndDate).toISOString().slice(0, 10) : "", expirationDate: new Date(cycle.expirationDate).toISOString().slice(0, 10), entitledDays: String(cycle.entitledDays), soldDays: String(cycle.soldDays), adjustmentDays: String(cycle.adjustmentDays), exceptionJustification: cycle.exceptionJustification || "" });
    setShowCycleForm(true);
  }

  function startPeriodEdit(period: typeof periods[number]) {
    if (period.status !== "draft" && period.status !== "requested") return;
    setEditingPeriodId(period.id);
    setPeriodForm({ employeeId: String(period.employeeId), vacationCycleId: String(period.vacationCycleId), startDate: new Date(period.startDate).toISOString().slice(0, 10), endDate: new Date(period.endDate).toISOString().slice(0, 10), status: period.status, exceptionJustification: period.exceptionJustification || "" });
    setShowPeriodForm(true);
  }

  return (
    <div className="mx-auto max-w-[1440px]">
      <header className="flex flex-col gap-6 border-b border-[#dce1da] pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#65766d]">Planejamento</p>
          <h1 className="mt-3 font-display text-4xl leading-none text-[#173f35] sm:text-5xl">Períodos e aprovações</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#617067] sm:text-base">Cadastre ciclos, distribua períodos, acompanhe saldos e concentre decisões em um fluxo auditável.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" onClick={() => setShowCycleForm(value => !value)} disabled={!canPlan} className="h-11 rounded-xl border-[#b9c6ba] bg-white text-[#173f35] hover:bg-[#eef2ed]"><FilePlus2 className="mr-2 h-4 w-4" />Novo ciclo</Button>
          <Button onClick={() => setShowPeriodForm(value => !value)} disabled={!canPlan} className="h-11 rounded-xl bg-[#173f35] text-white hover:bg-[#0f3027]"><Plus className="mr-2 h-4 w-4" />Novo período</Button>
        </div>
      </header>

      {!canPlan && <p className="mt-5 rounded-xl border border-[#e9d5a1] bg-[#fff9e7] px-4 py-3 text-sm text-[#6e5721]">Seu perfil é de consulta ou aprovação. Apenas usuários de planejamento podem criar ciclos e períodos.</p>}

      {employees.length === 0 && !employeesQuery.isLoading ? (
        <section className="mt-7 rounded-3xl border border-[#dce1da] bg-white px-6 py-16 text-center shadow-[0_8px_24px_rgba(37,58,48,0.04)]"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e6eee5] text-[#23604b]"><CalendarDays className="h-6 w-6" /></span><h2 className="mt-5 font-display text-3xl text-[#173f35]">Cadastre a equipe antes de planejar.</h2><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#66736c]">Os ciclos e os períodos sempre pertencem a um colaborador. Estruture cargos, grupos e bases na mesma etapa para aproveitar os filtros nas próximas entregas.</p><Link href="/equipe" className="mt-6 inline-flex items-center rounded-xl bg-[#173f35] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f3027]">Abrir cadastro da equipe</Link></section>
      ) : (
        <>
          {showCycleForm && canPlan && (
            <section className="mt-6 rounded-3xl border border-[#dce1da] bg-white p-6 shadow-[0_8px_24px_rgba(37,58,48,0.04)] sm:p-7"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#65766d]">Direito e vencimento</p><h2 className="mt-2 font-display text-2xl text-[#173f35]">Novo ciclo de férias</h2></div><button onClick={() => setShowCycleForm(false)} className="rounded-xl px-3 py-2 text-sm font-semibold text-[#315f4d] hover:bg-[#eef2ed]">Fechar</button></div><form onSubmit={submitCycle} className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><label className="block text-sm font-semibold text-[#334c40] xl:col-span-2">Colaborador<select required value={cycleForm.employeeId} onChange={event => setCycleForm(current => ({ ...current, employeeId: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-[#cfd8d0] bg-white px-3 text-sm font-normal outline-none ring-[#4d8768] focus:ring-2"><option value="">Selecionar</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}</select></label><label className="block text-sm font-semibold text-[#334c40]">Referência<input required value={cycleForm.reference} onChange={event => setCycleForm(current => ({ ...current, reference: event.target.value }))} placeholder="Ex.: 2026/2027" className="mt-2 h-11 w-full rounded-xl border border-[#cfd8d0] px-3 text-sm font-normal outline-none ring-[#4d8768] focus:ring-2" /></label><label className="block text-sm font-semibold text-[#334c40]">Vencimento<input required type="date" value={cycleForm.expirationDate} onChange={event => setCycleForm(current => ({ ...current, expirationDate: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-[#cfd8d0] px-3 text-sm font-normal outline-none ring-[#4d8768] focus:ring-2" /></label><label className="block text-sm font-semibold text-[#334c40]">Início aquisitivo<input type="date" value={cycleForm.accrualStartDate} onChange={event => setCycleForm(current => ({ ...current, accrualStartDate: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-[#cfd8d0] px-3 text-sm font-normal outline-none ring-[#4d8768] focus:ring-2" /></label><label className="block text-sm font-semibold text-[#334c40]">Fim aquisitivo<input type="date" value={cycleForm.accrualEndDate} onChange={event => setCycleForm(current => ({ ...current, accrualEndDate: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-[#cfd8d0] px-3 text-sm font-normal outline-none ring-[#4d8768] focus:ring-2" /></label><label className="block text-sm font-semibold text-[#334c40]">Direito (dias)<input required min="1" max="60" type="number" value={cycleForm.entitledDays} onChange={event => setCycleForm(current => ({ ...current, entitledDays: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-[#cfd8d0] px-3 text-sm font-normal outline-none ring-[#4d8768] focus:ring-2" /></label><label className="block text-sm font-semibold text-[#334c40]">Abono (dias)<input required min="0" max="30" type="number" value={cycleForm.soldDays} onChange={event => setCycleForm(current => ({ ...current, soldDays: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-[#cfd8d0] px-3 text-sm font-normal outline-none ring-[#4d8768] focus:ring-2" /></label><label className="block text-sm font-semibold text-[#334c40]">Ajuste (dias)<input required min="-30" max="30" type="number" value={cycleForm.adjustmentDays} onChange={event => setCycleForm(current => ({ ...current, adjustmentDays: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-[#cfd8d0] px-3 text-sm font-normal outline-none ring-[#4d8768] focus:ring-2" /></label><label className="block text-sm font-semibold text-[#334c40] xl:col-span-2">Justificativa de exceção<textarea value={cycleForm.exceptionJustification} onChange={event => setCycleForm(current => ({ ...current, exceptionJustification: event.target.value }))} placeholder="Obrigatória quando houver ajuste de saldo." className="mt-2 min-h-11 w-full rounded-xl border border-[#cfd8d0] px-3 py-2 text-sm font-normal outline-none ring-[#4d8768] focus:ring-2" /></label><div className="flex items-end"><Button type="submit" disabled={createCycle.isPending} className="h-11 w-full rounded-xl bg-[#173f35] text-white hover:bg-[#0f3027]">{createCycle.isPending ? "Salvando..." : "Salvar ciclo"}</Button></div></form>{createCycle.isError && <p className="mt-4 flex items-center gap-2 text-sm text-[#a14332]"><CircleAlert className="h-4 w-4" />{createCycle.error.message}</p>}</section>
          )}

          {showPeriodForm && canPlan && (
            <section className="mt-6 rounded-3xl border border-[#dce1da] bg-white p-6 shadow-[0_8px_24px_rgba(37,58,48,0.04)] sm:p-7"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#65766d]">Fracionamento e solicitação</p><h2 className="mt-2 font-display text-2xl text-[#173f35]">Novo período</h2></div><button onClick={() => setShowPeriodForm(false)} className="rounded-xl px-3 py-2 text-sm font-semibold text-[#315f4d] hover:bg-[#eef2ed]">Fechar</button></div><form onSubmit={submitPeriod} className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><label className="block text-sm font-semibold text-[#334c40] xl:col-span-2">Colaborador<select required value={periodForm.employeeId} onChange={event => setPeriodForm(current => ({ ...current, employeeId: event.target.value, vacationCycleId: "" }))} className="mt-2 h-11 w-full rounded-xl border border-[#cfd8d0] bg-white px-3 text-sm font-normal outline-none ring-[#4d8768] focus:ring-2"><option value="">Selecionar</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}</select></label><label className="block text-sm font-semibold text-[#334c40] xl:col-span-2">Ciclo<select required disabled={!periodForm.employeeId} value={periodForm.vacationCycleId} onChange={event => setPeriodForm(current => ({ ...current, vacationCycleId: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-[#cfd8d0] bg-white px-3 text-sm font-normal outline-none ring-[#4d8768] focus:ring-2"><option value="">Selecionar ciclo</option>{availableCycles.map(cycle => <option key={cycle.id} value={cycle.id}>{cycle.reference} · vence em {formatDate(cycle.expirationDate)} · saldo {Number(cycle.balance)}</option>)}</select></label><label className="block text-sm font-semibold text-[#334c40]">Início<input required type="date" value={periodForm.startDate} onChange={event => setPeriodForm(current => ({ ...current, startDate: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-[#cfd8d0] px-3 text-sm font-normal outline-none ring-[#4d8768] focus:ring-2" /></label><label className="block text-sm font-semibold text-[#334c40]">Fim<input required type="date" value={periodForm.endDate} onChange={event => setPeriodForm(current => ({ ...current, endDate: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-[#cfd8d0] px-3 text-sm font-normal outline-none ring-[#4d8768] focus:ring-2" /></label><div className="rounded-xl bg-[#edf3eb] px-3 py-2"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#65766d]">Dias corridos</p><p className="mt-1 font-display text-2xl text-[#173f35]">{calculatedDays ?? "—"}</p></div><label className="block text-sm font-semibold text-[#334c40]">Destino<select value={periodForm.status} onChange={event => setPeriodForm(current => ({ ...current, status: event.target.value as "draft" | "requested" }))} className="mt-2 h-11 w-full rounded-xl border border-[#cfd8d0] bg-white px-3 text-sm font-normal outline-none ring-[#4d8768] focus:ring-2"><option value="draft">Salvar como rascunho</option><option value="requested">Enviar para aprovação</option></select></label><label className="block text-sm font-semibold text-[#334c40] xl:col-span-3">Justificativa de exceção<textarea value={periodForm.exceptionJustification} onChange={event => setPeriodForm(current => ({ ...current, exceptionJustification: event.target.value }))} placeholder="Inclua uma observação quando o período exigir tratativa especial." className="mt-2 min-h-11 w-full rounded-xl border border-[#cfd8d0] px-3 py-2 text-sm font-normal outline-none ring-[#4d8768] focus:ring-2" /></label><div className="flex items-end"><Button type="submit" disabled={createPeriod.isPending || !calculatedDays} className="h-11 w-full rounded-xl bg-[#173f35] text-white hover:bg-[#0f3027]">{createPeriod.isPending ? "Salvando..." : periodForm.status === "requested" ? "Enviar solicitação" : "Salvar rascunho"}</Button></div></form>{createPeriod.isError && <p className="mt-4 flex items-center gap-2 text-sm text-[#a14332]"><CircleAlert className="h-4 w-4" />{createPeriod.error.message}</p>}</section>
          )}

          <section className="mt-7 grid gap-5 xl:grid-cols-[1fr_1.25fr]">
            <article className="overflow-hidden rounded-3xl border border-[#dce1da] bg-white shadow-[0_8px_24px_rgba(37,58,48,0.04)]"><div className="border-b border-[#e3e8e2] px-6 py-5"><p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#718078]">Direitos e saldos</p><h2 className="mt-2 font-display text-2xl text-[#173f35]">Ciclos cadastrados</h2></div>{cyclesQuery.isLoading ? <div className="space-y-3 p-6">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-20 w-full bg-[#edf2eb]" />)}</div> : cycles.length === 0 ? <div className="px-6 py-12 text-center"><p className="font-display text-2xl text-[#173f35]">Nenhum ciclo lançado.</p><p className="mt-2 text-sm leading-6 text-[#66736c]">Depois de cadastrar colaboradores, informe o direito, abono e vencimento de cada ciclo.</p></div> : <div className="divide-y divide-[#edf0ec]">{cycles.map(cycle => <div key={cycle.id} className="p-5"><div className="flex items-start justify-between gap-4"><div><p className="font-semibold text-[#173f35]">{cycle.employeeName}</p><p className="mt-1 text-xs text-[#718078]">{cycle.reference} · vence em {formatDate(cycle.expirationDate)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${Number(cycle.balance) < 0 ? "bg-[#f9e5df] text-[#9d4737]" : "bg-[#e6eee5] text-[#23604b]"}`}>Saldo {Number(cycle.balance)} dia(s)</span></div><div className="mt-4 grid grid-cols-3 gap-2 text-xs"><div className="rounded-xl bg-[#f5f7f3] p-2.5"><p className="text-[#718078]">Direito</p><p className="mt-1 font-semibold text-[#173f35]">{cycle.entitledDays} dias</p></div><div className="rounded-xl bg-[#f5f7f3] p-2.5"><p className="text-[#718078]">Abono</p><p className="mt-1 font-semibold text-[#173f35]">{cycle.soldDays} dias</p></div><div className="rounded-xl bg-[#f5f7f3] p-2.5"><p className="text-[#718078]">Gozados</p><p className="mt-1 font-semibold text-[#173f35]">{Number(cycle.usedDays)} dias</p></div></div></div>)}</div>}</article>
            <article className="overflow-hidden rounded-3xl border border-[#dce1da] bg-white shadow-[0_8px_24px_rgba(37,58,48,0.04)]"><div className="border-b border-[#e3e8e2] px-6 py-5"><p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#718078]">Fluxo de aprovação</p><h2 className="mt-2 font-display text-2xl text-[#173f35]">Períodos planejados</h2></div>{periodsQuery.isLoading ? <div className="space-y-3 p-6">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-20 w-full bg-[#edf2eb]" />)}</div> : periods.length === 0 ? <div className="px-6 py-12 text-center"><p className="font-display text-2xl text-[#173f35]">Nenhum período planejado.</p><p className="mt-2 text-sm leading-6 text-[#66736c]">Os períodos podem ser salvos em rascunho ou enviados diretamente para aprovação.</p></div> : <div className="divide-y divide-[#edf0ec]">{periods.map(period => <div key={period.id} className="p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-[#173f35]">{period.employeeName}</p><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[period.status as PeriodStatus]}`}>{statusLabels[period.status as PeriodStatus]}</span></div><p className="mt-2 text-sm text-[#54635b]">{formatDate(period.startDate)} — {formatDate(period.endDate)} · {period.calendarDays} dias · ciclo {period.cycleReference}</p></div><div className="flex flex-wrap gap-2">{canPlan && period.status === "draft" && <Button size="sm" onClick={() => sendForApproval.mutate({ vacationPeriodId: period.id, toStatus: "requested" })} disabled={sendForApproval.isPending} className="rounded-lg bg-[#173f35] text-white hover:bg-[#0f3027]"><Send className="mr-1.5 h-3.5 w-3.5" />Enviar</Button>}{canApprove && period.status === "requested" && <><Button size="sm" onClick={() => handleDecision(period.id, "approved")} disabled={decide.isPending} className="rounded-lg bg-[#276246] text-white hover:bg-[#1d4e36]"><Check className="mr-1.5 h-3.5 w-3.5" />Aprovar</Button><Button size="sm" variant="outline" onClick={() => handleDecision(period.id, "rejected")} disabled={decide.isPending} className="rounded-lg border-[#e9b6aa] text-[#9d4737] hover:bg-[#fff5f2]"><X className="mr-1.5 h-3.5 w-3.5" />Rejeitar</Button></>}{canPlan && (period.status === "draft" || period.status === "requested" || period.status === "approved") && <Button size="sm" variant="ghost" onClick={() => handleCancellation(period.id)} disabled={cancel.isPending} className="rounded-lg text-[#66736c] hover:bg-[#edf0ec]">Cancelar</Button>}</div></div></div>)}</div>}</article>
          </section>
          {canPlan && (cycles.length > 0 || periods.some(period => period.status === "draft" || period.status === "requested" || period.status === "approved")) && <section className="mt-7 rounded-3xl border border-[#dce1da] bg-white p-6 shadow-[0_8px_24px_rgba(37,58,48,0.04)]"><p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#718078]">Manutenção auditável</p><h2 className="mt-2 font-display text-2xl text-[#173f35]">Revisar dados de planejamento</h2><p className="mt-2 text-sm leading-6 text-[#66736c]">Ciclos podem ser atualizados. Períodos podem ser editados até a decisão e os aprovados podem ser concluídos após o gozo.</p><div className="mt-5 grid gap-6 xl:grid-cols-3"><div><h3 className="text-sm font-semibold text-[#334c40]">Ciclos</h3><div className="mt-3 space-y-2">{cycles.slice(0, 8).map(cycle => <div key={cycle.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#e3e8e2] px-3 py-2"><span className="min-w-0 truncate text-sm text-[#54635b]">{cycle.employeeName} · {cycle.reference}</span><Button size="sm" variant="outline" onClick={() => startCycleEdit(cycle)} className="shrink-0 rounded-lg border-[#cfd8d0] text-[#315f4d] hover:bg-[#eef2ed]"><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button></div>)}</div></div><div><h3 className="text-sm font-semibold text-[#334c40]">Períodos editáveis</h3><div className="mt-3 space-y-2">{periods.filter(period => period.status === "draft" || period.status === "requested").slice(0, 8).map(period => <div key={period.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#e3e8e2] px-3 py-2"><span className="min-w-0 truncate text-sm text-[#54635b]">{period.employeeName} · {formatDate(period.startDate)} — {formatDate(period.endDate)}</span><Button size="sm" variant="outline" onClick={() => startPeriodEdit(period)} className="shrink-0 rounded-lg border-[#cfd8d0] text-[#315f4d] hover:bg-[#eef2ed]"><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button></div>)}{!periods.some(period => period.status === "draft" || period.status === "requested") && <p className="rounded-xl bg-[#f5f7f3] px-3 py-3 text-sm text-[#66736c]">Não há períodos editáveis no momento.</p>}</div></div><div><h3 className="text-sm font-semibold text-[#334c40]">Períodos aprovados</h3><div className="mt-3 space-y-2">{periods.filter(period => period.status === "approved").slice(0, 8).map(period => <div key={period.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#e3e8e2] px-3 py-2"><span className="min-w-0 truncate text-sm text-[#54635b]">{period.employeeName} · {formatDate(period.startDate)} — {formatDate(period.endDate)}</span><Button size="sm" onClick={() => complete.mutate({ vacationPeriodId: period.id, toStatus: "completed", comment: "Período concluído." })} disabled={complete.isPending} className="shrink-0 rounded-lg bg-[#276246] text-white hover:bg-[#1d4e36]">Concluir</Button></div>)}{!periods.some(period => period.status === "approved") && <p className="rounded-xl bg-[#f5f7f3] px-3 py-3 text-sm text-[#66736c]">Não há períodos aprovados a concluir.</p>}</div></div></div></section>}
        </>
      )}
    </div>
  );
}

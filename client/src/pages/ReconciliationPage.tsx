import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Link2, Search, TriangleAlert, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(value));
}

const PAGE_SIZE = 15;

export default function ReconciliationPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [cycleByEntry, setCycleByEntry] = useState<Record<number, string>>({});
  const [noteByEntry, setNoteByEntry] = useState<Record<number, string>>({});
  const pending = trpc.reconciliation.listPending.useQuery(undefined, { enabled: Boolean(user) });
  const resolve = trpc.reconciliation.resolve.useMutation({ onSuccess: () => utils.reconciliation.listPending.invalidate() });
  const dismiss = trpc.reconciliation.dismiss.useMutation({ onSuccess: () => utils.reconciliation.listPending.invalidate() });
  const entries = useMemo(() => (pending.data ?? []).filter(entry => `${entry.employeeName ?? ""} ${entry.sourceCycleReference ?? ""}`.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"))), [pending.data, query]);
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageEntries = entries.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const canManage = user?.role === "planner" || user?.role === "admin";

  if (!canManage) {
    return <div className="mx-auto max-w-3xl rounded-3xl border border-[#e9d5a1] bg-[#fff9e7] p-7 text-[#6e5721]"><h1 className="font-display text-3xl">Reconciliação de períodos</h1><p className="mt-3">A vinculação ou o descarte de períodos importados exige permissão de planejamento.</p></div>;
  }

  return <div className="mx-auto max-w-[1240px]">
    <header className="border-b border-[#dce1da] pb-7"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#65766d]">Migração assistida</p><h1 className="mt-3 font-display text-4xl leading-none text-[#173f35] sm:text-5xl">Períodos sem ciclo</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[#617067] sm:text-base">Estes períodos foram preservados da planilha, mas não entraram no calendário porque o ciclo de origem não pôde ser reconhecido. Vincule cada item a um ciclo do mesmo colaborador ou descarte-o com uma justificativa auditável.</p></header>
    <section className="mt-7 rounded-3xl border border-[#ead9a3] bg-[#fff9e8] p-5 text-[#6b5623]"><div className="flex gap-3"><TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" /><p className="text-sm leading-6">A vinculação não é automática. Confirme referência e datas antes de salvar: o período passará a impactar calendário, saldo e regras de cobertura. Se o item não se aplicar, descarte-o somente com justificativa.</p></div></section>
    <div className="mt-7 flex flex-col gap-4 rounded-3xl border border-[#dce1da] bg-white p-5 shadow-[0_8px_24px_rgba(37,58,48,0.04)] sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#718078]">Fila pendente</p><p className="mt-1 font-display text-3xl text-[#173f35]">{pending.data?.length ?? 0} período(s)</p></div><label className="relative block w-full sm:w-80"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#718078]" /><Input value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Buscar colaborador ou ciclo" className="h-11 rounded-xl border-[#cfd8d0] pl-10" aria-label="Buscar pendências de reconciliação" /></label></div>
    {pending.isLoading ? <div className="mt-6 space-y-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-3xl bg-[#e9eee8]" />)}</div> : entries.length ? <><div className="mt-6 space-y-4">{pageEntries.map(entry => {
      const selection = cycleByEntry[entry.id] ?? "";
      const note = noteByEntry[entry.id] ?? "";
      return <article key={entry.id} className="rounded-3xl border border-[#dce1da] bg-white p-5 shadow-[0_8px_24px_rgba(37,58,48,0.04)]"><div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><p className="font-display text-2xl text-[#173f35]">{entry.employeeName ?? "Colaborador não reconhecido"}</p><p className="mt-2 text-sm text-[#617067]">{formatDate(entry.sourceStartDate)} a {formatDate(entry.sourceEndDate)} · {entry.calendarDays} dia(s) · status importado: <strong>{entry.sourceStatus}</strong></p><p className="mt-2 text-sm text-[#617067]">Referência da planilha: <strong>{entry.sourceCycleReference || "não informada"}</strong> · linha {entry.sourceRowNumber}</p></div><span className="w-fit rounded-full bg-[#f2f3f1] px-2.5 py-1 text-xs font-semibold text-[#65766d]">Pendente</span></div><div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]"><label className="text-sm font-semibold text-[#334c40]">Ciclo do colaborador<select value={selection} onChange={event => setCycleByEntry(current => ({ ...current, [entry.id]: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-[#cfd8d0] bg-white px-3 font-normal outline-none focus:ring-2 focus:ring-[#4d8768]"><option value="">Selecione um ciclo</option>{entry.candidateCycles.map(cycle => <option key={cycle.id} value={cycle.id}>{cycle.reference} · vence em {formatDate(cycle.expirationDate)}</option>)}</select></label><label className="text-sm font-semibold text-[#334c40]">Nota de reconciliação ou descarte<Input value={note} onChange={event => setNoteByEntry(current => ({ ...current, [entry.id]: event.target.value }))} className="mt-2 h-11 rounded-xl border-[#cfd8d0]" placeholder="Obrigatória ao descartar" /></label><Button disabled={!selection || resolve.isPending || dismiss.isPending} onClick={() => resolve.mutate({ reconciliationId: entry.id, vacationCycleId: Number(selection), resolutionNote: note || undefined })} className="h-11 self-end rounded-xl bg-[#173f35] text-white hover:bg-[#0f3027]"><Link2 className="mr-2 h-4 w-4" />Vincular</Button><Button variant="outline" disabled={note.trim().length < 3 || dismiss.isPending || resolve.isPending} onClick={() => { if (window.confirm("Descartar este período pendente? A justificativa será registrada e o item não entrará no calendário.")) dismiss.mutate({ reconciliationId: entry.id, resolutionNote: note.trim() }); }} className="h-11 self-end rounded-xl border-[#d9b1a8] text-[#914333] hover:bg-[#fff5f2]"><XCircle className="mr-2 h-4 w-4" />Descartar</Button></div>{entry.candidateCycles.length === 0 && <p role="alert" className="mt-4 text-sm text-[#a14332]">Não há ciclos publicados para este colaborador. Cadastre ou corrija o ciclo em Planejamento antes de vincular o período.</p>}{(resolve.error || dismiss.error) && <p role="alert" className="mt-4 text-sm text-[#a14332]">{resolve.error?.message || dismiss.error?.message}</p>}</article>;
    })}</div><nav aria-label="Paginação da fila de reconciliação" className="mt-6 flex flex-col gap-3 rounded-2xl border border-[#dce1da] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-[#617067]">Exibindo {Math.min((currentPage - 1) * PAGE_SIZE + 1, entries.length)}–{Math.min(currentPage * PAGE_SIZE, entries.length)} de {entries.length} período(s).</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(current => Math.max(1, current - 1))} className="rounded-lg border-[#cfd8d0]">Anterior</Button><span className="flex items-center px-2 text-sm font-semibold text-[#315f4d]">Página {currentPage} de {totalPages}</span><Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setPage(current => Math.min(totalPages, current + 1))} className="rounded-lg border-[#cfd8d0]">Próxima</Button></div></nav></> : <section className="mt-6 rounded-3xl border border-[#dce1da] bg-white px-6 py-16 text-center"><CheckCircle2 className="mx-auto h-7 w-7 text-[#387455]" /><h2 className="mt-4 font-display text-3xl text-[#173f35]">Nenhuma pendência encontrada.</h2><p className="mt-2 text-sm text-[#617067]">Todos os períodos estão reconciliados ou o filtro não encontrou resultados.</p></section>}
  </div>;
}

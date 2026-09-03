import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, UploadCloud } from "lucide-react";
import { ChangeEvent, useState } from "react";
import { toast } from "sonner";

function bytesToMegabytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ImportPage() {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const previewMutation = trpc.imports.previewWorkbook.useMutation();
  const utils = trpc.useUtils();
  const publishMutation = trpc.imports.publishBatch.useMutation({
    onSuccess: async result => {
      await Promise.all([utils.employees.list.invalidate(), utils.organization.list.invalidate("jobRole"), utils.organization.list.invalidate("base"), utils.dashboard.summary.invalidate()]);
      toast.success(`${result.createdEmployees} colaborador(es) publicado(s) com sucesso.`);
    },
  });
  const canImport = user?.role === "admin";

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setClientError(null);
    previewMutation.reset();
    if (!file) return setSelectedFile(null);
    if (!/\.xlsx$/i.test(file.name)) {
      setSelectedFile(null);
      setClientError("Selecione uma planilha no formato XLSX.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setSelectedFile(null);
      setClientError("A prévia aceita arquivos de até 20 MB.");
      return;
    }
    setSelectedFile(file);
  }

  function createPreview() {
    if (!selectedFile) return;
    const reader = new FileReader();
    reader.onerror = () => setClientError("Não foi possível ler o arquivo selecionado.");
    reader.onload = () => {
      const base64 = String(reader.result).split(",")[1];
      if (!base64) return setClientError("Não foi possível preparar o arquivo para importação.");
      previewMutation.mutate({ filename: selectedFile.name, fileBase64: base64 });
    };
    reader.readAsDataURL(selectedFile);
  }

  const preview = previewMutation.data;
  const canPublish = canImport && preview?.errorRows === 0 && !publishMutation.isSuccess;

  function publishPreview() {
    if (!preview) return;
    if (!window.confirm("Confirmar a publicação? Os colaboradores novos serão criados e os já existentes serão preservados.")) return;
    publishMutation.mutate({ batchId: preview.batchId, confirm: true });
  }

  return (
    <div className="mx-auto max-w-[1180px]">
      <header className="border-b border-[#dce1da] pb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#65766d]">Migração assistida</p>
        <h1 className="mt-3 font-display text-4xl leading-none text-[#173f35] sm:text-5xl">Importação da planilha</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#617067] sm:text-base">Envie o arquivo atual para gerar uma prévia controlada. O cadastro, os ciclos e os períodos serão publicados somente após confirmação administrativa.</p>
      </header>

      {!canImport && <p className="mt-5 rounded-xl border border-[#e9d5a1] bg-[#fff9e7] px-4 py-3 text-sm text-[#6e5721]">A criação de prévias de importação é restrita ao perfil de administração.</p>}

      <section className="mt-7 grid gap-5 lg:grid-cols-[1.12fr_0.88fr]">
        <article className="rounded-3xl border border-[#dce1da] bg-white p-6 shadow-[0_8px_24px_rgba(37,58,48,0.04)] sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e6eee5] text-[#23604b]"><FileSpreadsheet className="h-6 w-6" /></div>
          <h2 className="mt-6 font-display text-3xl text-[#173f35]">Gerar prévia segura</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#66736c]">O arquivo é armazenado de forma protegida para auditoria. O sistema identifica a base de férias, mapeia os registros de colaboradores e separa campos que precisam de revisão.</p>
          <label className="mt-7 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#aebeb1] bg-[#f8faf7] px-5 py-8 text-center transition-colors hover:border-[#4d8768] hover:bg-[#f1f6ef]">
            <UploadCloud className="h-7 w-7 text-[#315f4d]" />
            <span className="mt-3 text-sm font-semibold text-[#173f35]">Selecionar arquivo XLSX</span>
            <span className="mt-1 text-xs text-[#718078]">Limite de 20 MB · Planilhas protegidas ou corrompidas serão recusadas.</span>
            <input className="sr-only" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFileChange} disabled={!canImport || previewMutation.isPending} />
          </label>
          {selectedFile && <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-[#edf3eb] px-4 py-3 text-sm"><span className="truncate font-semibold text-[#173f35]">{selectedFile.name}</span><span className="shrink-0 text-[#567065]">{bytesToMegabytes(selectedFile.size)}</span></div>}
          {clientError && <p className="mt-4 flex items-center gap-2 text-sm text-[#a14332]"><AlertTriangle className="h-4 w-4" />{clientError}</p>}
          {previewMutation.isError && <p className="mt-4 flex items-center gap-2 text-sm text-[#a14332]"><AlertTriangle className="h-4 w-4" />{previewMutation.error.message}</p>}
          <Button onClick={createPreview} disabled={!selectedFile || !canImport || previewMutation.isPending} className="mt-6 h-11 w-full rounded-xl bg-[#173f35] text-white hover:bg-[#0f3027]">{previewMutation.isPending ? "Processando prévia..." : "Gerar prévia da importação"}</Button>
        </article>

        <article className="rounded-3xl bg-[#173f35] p-6 text-white shadow-[0_12px_30px_rgba(23,63,53,0.16)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#bad0bd]">Processo controlado</p>
          <ol className="mt-6 space-y-5">
            <li className="flex gap-4"><span className="font-display text-3xl text-[#e8d8a9]">01</span><div><p className="font-semibold">Leitura da estrutura</p><p className="mt-1 text-sm leading-6 text-[#c6d5c7]">Localiza a aba-base, o cabeçalho e os blocos de períodos encontrados.</p></div></li>
            <li className="flex gap-4"><span className="font-display text-3xl text-[#e8d8a9]">02</span><div><p className="font-semibold">Validação e pendências</p><p className="mt-1 text-sm leading-6 text-[#c6d5c7]">Sinaliza ausência de cargo, base, data reconhecida ou outros campos importantes.</p></div></li>
            <li className="flex gap-4"><span className="font-display text-3xl text-[#e8d8a9]">03</span><div><p className="font-semibold">Confirmação de publicação</p><p className="mt-1 text-sm leading-6 text-[#c6d5c7]">A publicação fica disponível somente após reconciliação e decisão explícita da área responsável.</p></div></li>
          </ol>
        </article>
      </section>

      {preview && (
        <section className="mt-7 rounded-3xl border border-[#dce1da] bg-white shadow-[0_8px_24px_rgba(37,58,48,0.04)]">
          <div className="flex flex-col gap-3 border-b border-[#e3e8e2] px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8"><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#65766d]">Prévia criada · lote #{preview.batchId}</p><h2 className="mt-2 font-display text-3xl text-[#173f35]">{preview.sourceSheetName || "Aba não identificada"}</h2></div><span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#e6eee5] px-3 py-1.5 text-xs font-semibold text-[#23604b]"><CheckCircle2 className="h-4 w-4" />Arquivo registrado</span></div>
          <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 sm:p-8"><Metric label="Registros lidos" value={preview.totalRows} /><Metric label="Aceitos na prévia" value={preview.acceptedRows} tone="green" /><Metric label="Ciclos mapeados" value={preview.vacationCycles.length} tone="green" /><Metric label="Períodos mapeados" value={preview.vacationPeriods.length} tone="green" /><Metric label="Com alerta" value={preview.warningRows} tone="gold" /><Metric label="Com erro" value={preview.errorRows} tone="coral" /></div>
          <div className="grid gap-6 border-t border-[#e3e8e2] p-6 lg:grid-cols-[1.15fr_0.85fr] sm:p-8"><div><h3 className="font-display text-2xl text-[#173f35]">Amostra de colaboradores</h3><div className="mt-4 overflow-x-auto rounded-2xl border border-[#e3e8e2]"><table className="w-full min-w-[630px] text-left text-sm"><thead className="bg-[#fafbf9] text-xs font-semibold uppercase tracking-[0.11em] text-[#718078]"><tr><th className="px-4 py-3">Linha</th><th className="px-4 py-3">Colaborador</th><th className="px-4 py-3">Cargo</th><th className="px-4 py-3">Base</th></tr></thead><tbody>{preview.employees.slice(0, 12).map(employee => <tr key={`${employee.rowNumber}-${employee.fullName}`} className="border-t border-[#edf0ec]"><td className="px-4 py-3 text-[#718078]">{employee.rowNumber}</td><td className="px-4 py-3 font-semibold text-[#173f35]">{employee.fullName}</td><td className="px-4 py-3 text-[#54635b]">{employee.jobRole || "Não identificado"}</td><td className="px-4 py-3 text-[#54635b]">{employee.base || "Não identificada"}</td></tr>)}</tbody></table></div></div><div><h3 className="font-display text-2xl text-[#173f35]">Pendências encontradas</h3>{preview.issues.length === 0 ? <div className="mt-4 rounded-2xl bg-[#edf3eb] p-5 text-sm leading-6 text-[#23604b]">Não foram encontradas pendências na leitura inicial. A reconciliação de períodos continuará antes da publicação.</div> : <div className="mt-4 space-y-3">{preview.issues.slice(0, 8).map((issue, index) => <div key={`${issue.rowNumber}-${issue.field}-${index}`} className={`rounded-2xl border p-4 ${issue.severity === "error" ? "border-[#f0c1b6] bg-[#fff5f2]" : "border-[#e9d5a1] bg-[#fff9e7]"}`}><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-[#3c4b42]">{issue.field ? issue.field.replaceAll("_", " ") : "Estrutura do arquivo"}</p><span className="text-xs font-semibold uppercase tracking-wide text-[#718078]">{issue.rowNumber ? `Linha ${issue.rowNumber}` : "Geral"}</span></div><p className="mt-2 text-sm leading-5 text-[#66736c]">{issue.message}</p></div>)}</div>}</div></div>
          <div className="flex flex-col gap-4 border-t border-[#e3e8e2] bg-[#fafbf9] px-6 py-5 text-sm leading-6 text-[#66736c] sm:flex-row sm:items-center sm:justify-between sm:px-8"><div><strong className="text-[#173f35]">{preview.errorRows > 0 ? "Publicação bloqueada:" : "Pronto para publicar:"}</strong> {preview.errorRows > 0 ? "corrija as pendências impeditivas identificadas antes de confirmar a carga." : "a confirmação cria apenas colaboradores, cargos, bases, ciclos e períodos ausentes ou reconhecidos no lote, sem substituir registros existentes."}{publishMutation.isSuccess && <span className="block mt-2 text-[#23604b]">Publicação concluída: {publishMutation.data.createdEmployees} colaborador(es), {publishMutation.data.createdCycles} ciclo(s) e {publishMutation.data.createdPeriods} período(s) criados; {publishMutation.data.skippedPeriods} período(s) foram mantidos fora da carga por falta de ciclo correspondente.</span>}{publishMutation.isError && <span className="block mt-2 text-[#a14332]">{publishMutation.error.message}</span>}</div><Button onClick={publishPreview} disabled={!canPublish || publishMutation.isPending} className="h-11 shrink-0 rounded-xl bg-[#173f35] text-white hover:bg-[#0f3027]">{publishMutation.isPending ? "Publicando..." : publishMutation.isSuccess ? "Lote publicado" : "Confirmar publicação"}</Button></div>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value, tone = "slate" }: { label: string; value: number; tone?: "green" | "gold" | "coral" | "slate" }) {
  const tones = { green: "bg-[#e6eee5] text-[#23604b]", gold: "bg-[#f7efd8] text-[#85601d]", coral: "bg-[#f9e5df] text-[#9d4737]", slate: "bg-[#edf0ec] text-[#40594f]" };
  return <div className={`rounded-2xl p-4 ${tones[tone]}`}><p className="text-xs font-semibold uppercase tracking-[0.11em] opacity-75">{label}</p><p className="mt-3 font-display text-4xl">{value}</p></div>;
}

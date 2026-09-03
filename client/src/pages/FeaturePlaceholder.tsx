import { ArrowLeft, Construction, type LucideIcon } from "lucide-react";
import { Link } from "wouter";

type FeaturePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  scope: string[];
};

export default function FeaturePlaceholder({ eyebrow, title, description, icon: Icon, scope }: FeaturePlaceholderProps) {
  return (
    <div className="mx-auto max-w-5xl py-4 sm:py-8">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#315f4d] transition-colors hover:text-[#173f35]">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Voltar para a visão geral
      </Link>
      <section className="mt-7 overflow-hidden rounded-[2rem] border border-[#dce1da] bg-white shadow-[0_12px_35px_rgba(37,58,48,0.06)]">
        <div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#65766d]">{eyebrow}</p>
            <h1 className="mt-3 font-display text-4xl leading-none text-[#173f35] sm:text-5xl">{title}</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#617067]">{description}</p>
          </div>
          <div className="rounded-3xl bg-[#e6eee5] p-6 text-[#23604b]">
            <Icon className="h-8 w-8" aria-hidden="true" />
            <p className="mt-8 text-sm font-semibold">Módulo em preparação</p>
            <p className="mt-2 text-sm leading-6 text-[#46715f]">A fundação de dados, validações e navegação já está pronta. Esta área será ativada no incremento correspondente.</p>
          </div>
        </div>
        <div className="border-t border-[#e3e8e2] bg-[#fafbf9] p-7 sm:p-10">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#173f35]"><Construction className="h-4 w-4 text-[#b9832d]" aria-hidden="true" /> Entregas previstas</div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {scope.map(item => <div key={item} className="rounded-xl border border-[#e3e8e2] bg-white px-4 py-3 text-sm text-[#54635b]">{item}</div>)}
          </div>
        </div>
      </section>
    </div>
  );
}

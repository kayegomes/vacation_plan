import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { CalendarDays, KeyRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { useLocation } from "wouter";

export default function ActivateInternalAccountPage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const activation = trpc.auth.activateInternalAccount.useMutation({ onSuccess: async () => { await utils.auth.me.invalidate(); setLocation("/"); } });
  async function submit(event: FormEvent) { event.preventDefault(); await activation.mutateAsync({ token, password, confirmation }); }
  return <div className="min-h-screen bg-[#f4f5f1] px-5 py-8 text-foreground"><div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center"><main className="rounded-[2rem] border border-[#dce1da] bg-white p-8 shadow-[0_22px_70px_rgba(34,51,43,0.12)] sm:p-10"><div className="mb-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#173f35] text-[#e8d8a9]"><CalendarDays className="h-6 w-6" aria-hidden="true" /></div><p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#65766d]">Férias · convite de acesso</p><h1 className="font-display text-4xl leading-[1.03] text-[#173f35]">Defina sua senha.</h1><p className="mt-5 text-sm leading-6 text-[#59665f]">Crie uma senha com pelo menos 12 caracteres para ativar sua conta interna.</p><form onSubmit={submit} className="mt-7 space-y-4"><div className="space-y-2"><Label htmlFor="activation-password">Nova senha</Label><Input id="activation-password" type="password" autoComplete="new-password" minLength={12} value={password} onChange={event => setPassword(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="activation-confirmation">Confirme a senha</Label><Input id="activation-confirmation" type="password" autoComplete="new-password" minLength={12} value={confirmation} onChange={event => setConfirmation(event.target.value)} required /></div>{activation.error && <p role="alert" className="rounded-xl border border-[#f0c1b6] bg-[#fff5f2] px-3 py-2 text-sm text-[#8f3c2c]">{activation.error.message}</p>}<Button type="submit" size="lg" disabled={activation.isPending || !token} className="h-12 w-full rounded-xl bg-[#173f35] text-white hover:bg-[#0f3027]"><KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />{activation.isPending ? "Ativando…" : "Ativar conta"}</Button></form></main></div></div>;
}

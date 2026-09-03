import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { CalendarDays, Mail } from "lucide-react";
import React from "react";
import { FormEvent, useState } from "react";
import { Link } from "wouter";

export default function PasswordResetRequestPage() {
  const [email, setEmail] = useState(""); const reset = trpc.auth.requestPasswordReset.useMutation();
  async function submit(event: FormEvent) { event.preventDefault(); await reset.mutateAsync({ email, origin: window.location.origin }); }
  return <div className="min-h-screen bg-[#f4f5f1] px-5 py-8 text-foreground"><div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center"><main className="rounded-[2rem] border border-[#dce1da] bg-white p-8 shadow-[0_22px_70px_rgba(34,51,43,0.12)] sm:p-10"><div className="mb-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#173f35] text-[#e8d8a9]"><CalendarDays className="h-6 w-6" /></div><p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#65766d]">Férias · acesso protegido</p><h1 className="font-display text-4xl leading-[1.03] text-[#173f35]">Redefina sua senha.</h1><p className="mt-5 text-sm leading-6 text-[#59665f]">Informe seu e-mail. Se houver uma conta ativa associada, enviaremos um link seguro para definição de nova senha.</p><form onSubmit={submit} className="mt-7 space-y-4"><div className="space-y-2"><Label htmlFor="reset-email">E-mail</Label><Input id="reset-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required /></div>{reset.isSuccess && <p role="status" className="rounded-xl bg-[#edf3eb] px-3 py-2 text-sm text-[#23604b]">Se o e-mail estiver associado a uma conta ativa, você receberá as instruções em instantes.</p>}{reset.error && <p role="alert" className="rounded-xl border border-[#f0c1b6] bg-[#fff5f2] px-3 py-2 text-sm text-[#8f3c2c]">Não foi possível processar a solicitação agora.</p>}<Button type="submit" size="lg" disabled={reset.isPending} className="h-12 w-full rounded-xl bg-[#173f35] text-white hover:bg-[#0f3027]"><Mail className="mr-2 h-4 w-4" />{reset.isPending ? "Enviando…" : "Enviar instruções"}</Button></form><Link href="/entrar" className="mt-6 block text-center text-sm font-semibold text-[#315f4d] hover:underline">Voltar ao acesso</Link></main></div></div>;
}

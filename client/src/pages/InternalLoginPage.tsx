import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { CalendarDays, LockKeyhole } from "lucide-react";
import React from "react";
import { FormEvent, useState } from "react";
import { useLocation } from "wouter";
import { Link } from "wouter";

export default function InternalLoginPage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = trpc.auth.internalLogin.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      setLocation("/");
    },
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    await login.mutateAsync({ email, password });
  }

  return <div className="min-h-screen bg-[#f4f5f1] px-5 py-8 text-foreground"><div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center"><main className="rounded-[2rem] border border-[#dce1da] bg-white p-8 shadow-[0_22px_70px_rgba(34,51,43,0.12)] sm:p-10"><div className="mb-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#173f35] text-[#e8d8a9]"><CalendarDays className="h-6 w-6" aria-hidden="true" /></div><p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#65766d]">Férias · acesso protegido</p><h1 className="font-display text-4xl leading-[1.03] text-[#173f35]">Entre na sua conta.</h1><p className="mt-5 text-sm leading-6 text-[#59665f]">Use o e-mail e a senha definidos no seu convite para acessar o planejamento de férias.</p><form onSubmit={submit} className="mt-7 space-y-4"><div className="space-y-2"><Label htmlFor="login-email">E-mail</Label><Input id="login-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="login-password">Senha</Label><Input id="login-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></div>{login.error && <p role="alert" className="rounded-xl border border-[#f0c1b6] bg-[#fff5f2] px-3 py-2 text-sm text-[#8f3c2c]">{login.error.message}</p>}<Button type="submit" size="lg" disabled={login.isPending} className="h-12 w-full rounded-xl bg-[#173f35] text-white hover:bg-[#0f3027]"><LockKeyhole className="mr-2 h-4 w-4" aria-hidden="true" />{login.isPending ? "Entrando…" : "Entrar"}</Button></form><div className="mt-6 flex justify-between text-xs font-semibold text-[#315f4d]"><Link href="/redefinir-senha" className="hover:underline">Esqueci a senha</Link><span className="text-[#718078]">Solicite um convite à administração.</span></div></main></div></div>;
}

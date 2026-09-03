import { Resend } from "resend";
import { createHash } from "node:crypto";
import { ENV } from "./_core/env";
import { completeEmailDelivery, createEmailDelivery, listActiveNotificationRecipients } from "./db";

export type AlertEmail = { id: number; dedupeKey: string; title: string; description: string | null; category: string; severity: string; employeeName?: string | null };

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export function isEmailConfigured() {
  return Boolean(ENV.resendApiKey && ENV.emailFrom);
}

export function buildAlertEmail(alert: AlertEmail) {
  const description = alert.description ?? "Sem detalhes adicionais.";
  const employee = alert.employeeName ? `<p><strong>Colaborador:</strong> ${escapeHtml(alert.employeeName)}</p>` : "";
  return {
    subject: `[Férias] ${alert.title}`,
    text: `${alert.title}\n\n${description}${alert.employeeName ? `\n\nColaborador: ${alert.employeeName}` : ""}\n\nConsulte a central de alertas para registrar a tratativa.`,
    html: `<div style="font-family:Arial,sans-serif;color:#173f35;line-height:1.55"><h2 style="margin:0 0 12px">${escapeHtml(alert.title)}</h2><p>${escapeHtml(description)}</p>${employee}<p><strong>Categoria:</strong> ${escapeHtml(alert.category)} &middot; <strong>Severidade:</strong> ${escapeHtml(alert.severity)}</p><p style="color:#617067">Consulte a central de alertas do Sistema de Férias para registrar a tratativa.</p></div>`,
  };
}

async function deliver(input: { recipient: { id: number; email: string; name: string | null }; notificationType: "alert" | "test" | "weekly_summary"; subject: string; text: string; html: string; idempotencyKey: string; alertId?: number }) {
  const deliveryId = await createEmailDelivery({ alertId: input.alertId, recipientId: input.recipient.id, notificationType: input.notificationType, subject: input.subject, idempotencyKey: input.idempotencyKey });
  if (!deliveryId) return "skipped" as const;
  if (!isEmailConfigured()) {
    await completeEmailDelivery({ id: deliveryId, status: "failed", errorSummary: "Integração de e-mail não configurada." });
    return "failed" as const;
  }
  try {
    const resend = new Resend(ENV.resendApiKey);
    const { data, error } = await resend.emails.send({ from: ENV.emailFrom, to: [input.recipient.email], subject: input.subject, text: input.text, html: input.html, headers: { "Idempotency-Key": input.idempotencyKey }, tags: [{ name: "source", value: "vacation-system" }, { name: "type", value: input.notificationType }] });
    if (error) {
      await completeEmailDelivery({ id: deliveryId, status: "failed", errorSummary: error.message });
      return "failed" as const;
    }
    await completeEmailDelivery({ id: deliveryId, status: "sent", resendEmailId: data?.id });
    return "sent" as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida ao enviar e-mail.";
    await completeEmailDelivery({ id: deliveryId, status: "failed", errorSummary: message });
    return "failed" as const;
  }
}

export async function deliverNewAlertEmails(alerts: AlertEmail[]) {
  const recipients = await listActiveNotificationRecipients();
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const alert of alerts) {
    const message = buildAlertEmail(alert);
    for (const recipient of recipients) {
      const result = await deliver({ recipient, notificationType: "alert", subject: message.subject, text: message.text, html: message.html, alertId: alert.id, idempotencyKey: `alert/${alert.dedupeKey}/${recipient.id}` });
      if (result === "sent") sent += 1;
      else if (result === "failed") failed += 1;
      else skipped += 1;
    }
  }
  return { sent, failed, skipped };
}

function weekKey(value: Date) {
  const day = value.getUTCDay() || 7;
  const monday = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() - day + 1));
  return monday.toISOString().slice(0, 10);
}

export function buildWeeklySummaryEmail(alerts: AlertEmail[], referenceDate = new Date()) {
  const reference = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(referenceDate);
  const items = alerts.map(alert => `<li><strong>${escapeHtml(alert.title)}</strong>${alert.employeeName ? ` · ${escapeHtml(alert.employeeName)}` : ""}<br><span style="color:#617067">${escapeHtml(alert.description ?? "Sem detalhes adicionais.")}</span></li>`).join("");
  const summary = alerts.length ? `Há ${alerts.length} alerta(s) em aberto para acompanhamento.` : "Não há alertas em aberto nesta semana.";
  return {
    subject: `[Férias] Resumo semanal · ${reference}`,
    text: `Resumo semanal de Férias\n\n${summary}${alerts.length ? `\n\n${alerts.map(alert => `• ${alert.title}${alert.employeeName ? ` — ${alert.employeeName}` : ""}\n  ${alert.description ?? "Sem detalhes adicionais."}`).join("\n")}` : ""}\n\nConsulte a central de alertas para registrar tratativas.`,
    html: `<div style="font-family:Arial,sans-serif;color:#173f35;line-height:1.55;max-width:640px"><p style="margin:0;color:#617067;font-size:12px;text-transform:uppercase;letter-spacing:.08em">Férias · acompanhamento semanal</p><h2 style="margin:10px 0 12px">Resumo semanal</h2><p>${escapeHtml(summary)}</p>${alerts.length ? `<ul style="padding-left:20px">${items}</ul>` : ""}<p style="color:#617067">Consulte a central de alertas do Sistema de Férias para registrar a tratativa.</p></div>`,
  };
}

export async function deliverWeeklyAlertSummary(alerts: AlertEmail[], referenceDate = new Date()) {
  const recipients = await listActiveNotificationRecipients();
  const message = buildWeeklySummaryEmail(alerts, referenceDate);
  const key = weekKey(referenceDate);
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const recipient of recipients) {
    const result = await deliver({ recipient, notificationType: "weekly_summary", subject: message.subject, text: message.text, html: message.html, idempotencyKey: `weekly-summary/${key}/${recipient.id}` });
    if (result === "sent") sent += 1;
    else if (result === "failed") failed += 1;
    else skipped += 1;
  }
  return { sent, failed, skipped };
}

export async function sendTestEmail(recipientId: number) {
  const recipients = await listActiveNotificationRecipients();
  const recipient = recipients.find(entry => entry.id === recipientId);
  if (!recipient) throw new Error("Destinatário ativo não encontrado.");
  const moment = new Date().toISOString();
  return deliver({ recipient, notificationType: "test", subject: "[Férias] Teste de notificação", text: "Este é um teste do canal de e-mail do Sistema de Férias.", html: "<div style=\"font-family:Arial,sans-serif;color:#173f35\"><h2>Teste de notificação</h2><p>Este é um teste do canal de e-mail do Sistema de Férias.</p></div>", idempotencyKey: `test/${recipient.id}/${moment}` });
}

export async function sendInternalAccountInvite(input: { email: string; name: string; inviteUrl: string }) {
  if (!isEmailConfigured()) throw new Error("A integração de e-mail não está configurada.");
  const resend = new Resend(ENV.resendApiKey);
  const safeName = escapeHtml(input.name);
  const { data, error } = await resend.emails.send({
    from: ENV.emailFrom,
    to: [input.email],
    subject: "[Férias] Defina seu acesso ao sistema",
    text: `Olá, ${input.name}.\n\nVocê foi convidado para acessar o sistema Férias. Defina sua senha pelo link seguro abaixo (válido por 24 horas):\n${input.inviteUrl}\n\nSe você não reconhece este convite, ignore esta mensagem.`,
    html: `<div style="font-family:Arial,sans-serif;color:#173f35;line-height:1.55;max-width:640px"><p style="margin:0;color:#617067;font-size:12px;text-transform:uppercase;letter-spacing:.08em">Férias · acesso protegido</p><h2 style="margin:10px 0 12px">Defina sua senha</h2><p>Olá, ${safeName}.</p><p>Você foi convidado para acessar o sistema Férias. Use o botão abaixo para criar sua senha. O convite é válido por 24 horas.</p><p style="margin:28px 0"><a href="${input.inviteUrl}" style="display:inline-block;background:#173f35;color:#fff;text-decoration:none;border-radius:10px;padding:13px 18px;font-weight:700">Definir acesso</a></p><p style="color:#617067;font-size:13px">Se você não reconhece este convite, ignore esta mensagem.</p></div>`,
    headers: { "Idempotency-Key": `internal-invite/${createHash("sha256").update(input.inviteUrl).digest("hex")}` },
    tags: [{ name: "source", value: "vacation-system" }, { name: "type", value: "internal-invite" }],
  });
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export async function sendInternalPasswordReset(input: { email: string; name: string; resetUrl: string }) {
  if (!isEmailConfigured()) throw new Error("A integração de e-mail não está configurada.");
  const resend = new Resend(ENV.resendApiKey);
  const safeName = escapeHtml(input.name);
  const { data, error } = await resend.emails.send({ from: ENV.emailFrom, to: [input.email], subject: "[Férias] Redefina sua senha", text: `Olá, ${input.name}.\n\nUse este link seguro para redefinir sua senha (válido por 24 horas):\n${input.resetUrl}\n\nSe você não solicitou a alteração, ignore esta mensagem.`, html: `<div style="font-family:Arial,sans-serif;color:#173f35;line-height:1.55;max-width:640px"><p style="margin:0;color:#617067;font-size:12px;text-transform:uppercase;letter-spacing:.08em">Férias · acesso protegido</p><h2 style="margin:10px 0 12px">Redefina sua senha</h2><p>Olá, ${safeName}.</p><p>Use o botão abaixo para criar uma nova senha. O link é válido por 24 horas.</p><p style="margin:28px 0"><a href="${input.resetUrl}" style="display:inline-block;background:#173f35;color:#fff;text-decoration:none;border-radius:10px;padding:13px 18px;font-weight:700">Redefinir senha</a></p><p style="color:#617067;font-size:13px">Se você não solicitou a alteração, ignore esta mensagem.</p></div>`, headers: { "Idempotency-Key": `password-reset/${createHash("sha256").update(input.resetUrl).digest("hex")}` }, tags: [{ name: "source", value: "vacation-system" }, { name: "type", value: "password-reset" }] });
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

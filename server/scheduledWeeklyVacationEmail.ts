import type { Request, Response } from "express";
import { completeJobExecutionLog, createJobExecutionLog, getJobScheduleByTaskUid } from "./db";
import { sendWeeklyVacationSummary } from "./dailyVacationCheck";
import { sdk } from "./_core/sdk";

export async function scheduledWeeklyVacationEmail(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const schedule = await getJobScheduleByTaskUid(user.taskUid);
    if (!schedule || schedule.name !== "weekly-vacation-email" || !schedule.active) return res.json({ ok: true, skipped: "orphan-or-inactive" });
    const executionId = await createJobExecutionLog("weekly-vacation-email");
    try {
      const result = await sendWeeklyVacationSummary();
      await completeJobExecutionLog({ id: executionId, status: result.notificationsFailed ? "partial" : "success", ...result });
      return res.json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida";
      await completeJobExecutionLog({ id: executionId, status: "failed", recordsProcessed: 0, alertsCreated: 0, alertsUpdated: 0, notificationsSent: 0, errorSummary: message });
      return res.status(500).json({ error: message, taskUid: user.taskUid, timestamp: new Date().toISOString() });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha de autenticação";
    return res.status(500).json({ error: message, timestamp: new Date().toISOString() });
  }
}

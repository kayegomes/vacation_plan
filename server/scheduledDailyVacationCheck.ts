import type { Request, Response } from "express";
import { completeJobExecutionLog, createJobExecutionLog, getJobScheduleByTaskUid } from "./db";
import { inspectVacationPlanning, notifyDailyCheckFailure } from "./dailyVacationCheck";
import { sdk } from "./_core/sdk";

export async function scheduledDailyVacationCheck(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const schedule = await getJobScheduleByTaskUid(user.taskUid);
    if (!schedule || schedule.name !== "daily-vacation-check" || !schedule.active) return res.json({ ok: true, skipped: "orphan-or-inactive" });

    const executionId = await createJobExecutionLog("daily-vacation-check");
    try {
      const result = await inspectVacationPlanning();
      await completeJobExecutionLog({ id: executionId, status: result.notificationsFailed ? "partial" : "success", ...result });
      return res.json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida";
      const notification = await notifyDailyCheckFailure(message);
      await completeJobExecutionLog({ id: executionId, status: "failed", recordsProcessed: 0, alertsCreated: notification.created ? 1 : 0, alertsUpdated: notification.created ? 0 : 1, notificationsSent: notification.sent, errorSummary: message });
      return res.status(500).json({ error: message, taskUid: user.taskUid, timestamp: new Date().toISOString() });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha de autenticação";
    return res.status(500).json({ error: message, timestamp: new Date().toISOString() });
  }
}

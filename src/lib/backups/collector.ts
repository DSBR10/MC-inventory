import pLimit from "p-limit";
import { collectAWSBackups } from "./aws";
import { collectHuaweiBackups } from "./huawei";
import { createRefreshLog, finishRefreshLog, upsertBackups } from "./repository";
import type { BackupRefreshSummary } from "./types";

let running = false;

export async function refreshBackups(
  trigger: "manual" | "scheduled",
  triggeredBy?: string,
): Promise<BackupRefreshSummary> {
  if (running) {
    throw new Error("BACKUP_REFRESH_ALREADY_RUNNING");
  }
  running = true;
  const startedAt = new Date().toISOString();
  const logId = await createRefreshLog(trigger, triggeredBy);
  try {
    const limit = pLimit(2);
    const [aws, huawei] = await Promise.all([
      limit(() => collectAWSBackups()),
      limit(() => collectHuaweiBackups()),
    ]);
    const accounts = [...aws.accounts, ...huawei.accounts];
    const upserted = await upsertBackups([...aws.records, ...huawei.records]);
    const failed = accounts.filter((a) => !a.ok).length;
    const status = failed === 0 ? "success" : upserted > 0 || accounts.some((a) => a.ok) ? "partial" : "error";
    const finishedAt = new Date().toISOString();
    await finishRefreshLog(logId, status, upserted, { accounts, trigger });
    return { logId, trigger, status, recordsUpserted: upserted, accounts, startedAt, finishedAt };
  } catch (error: any) {
    const finishedAt = new Date().toISOString();
    await finishRefreshLog(logId, "error", 0, { error: error?.message || "Error desconocido", trigger });
    throw error;
  } finally {
    running = false;
  }
}

export function isBackupRefreshRunning(): boolean {
  return running;
}

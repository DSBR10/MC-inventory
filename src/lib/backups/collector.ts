import pLimit from "p-limit";
import { collectAWSBackups } from "./aws";
import { collectHuaweiBackups } from "./huawei";
import { collectAWSRdsBackups } from "./aws-rds";
import { collectHuaweiRdsBackups } from "./huawei-rds";
import { collectAWSLogBackups } from "./aws-logs";
import { collectHuaweiLogBackups } from "./huawei-logs";
import { createRefreshLog, finishRefreshLog, upsertBackups } from "./repository";
import { upsertRdsBackups, upsertLogBackups } from "./repository-extended";
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

    const [aws, huawei, awsRds, huaweiRds, awsLogs, huaweiLogs] = await Promise.all([
      limit(() => collectAWSBackups()),
      limit(() => collectHuaweiBackups()),
      limit(() => collectAWSRdsBackups()),
      limit(() => collectHuaweiRdsBackups()),
      limit(() => collectAWSLogBackups()),
      limit(() => collectHuaweiLogBackups()),
    ]);

    const accounts = [
      ...aws.accounts,
      ...huawei.accounts,
      ...awsRds.accounts,
      ...huaweiRds.accounts,
      ...awsLogs.accounts,
      ...huaweiLogs.accounts,
    ];

    const [serverUpserted, rdsUpserted, logUpserted] = await Promise.all([
      upsertBackups([...aws.records, ...huawei.records]),
      upsertRdsBackups([...awsRds.records, ...huaweiRds.records]),
      upsertLogBackups([...awsLogs.records, ...huaweiLogs.records]),
    ]);

    const totalUpserted = serverUpserted + rdsUpserted + logUpserted;
    const failed = accounts.filter((a) => !a.ok).length;
    const status = failed === 0 ? "success" : totalUpserted > 0 || accounts.some((a) => a.ok) ? "partial" : "error";
    const finishedAt = new Date().toISOString();
    await finishRefreshLog(logId, status, totalUpserted, {
      accounts,
      trigger,
      serverUpserted,
      rdsUpserted,
      logUpserted,
    });
    return { logId, trigger, status, recordsUpserted: totalUpserted, accounts, startedAt, finishedAt };
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

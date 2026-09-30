export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBackupScheduler } = await import("@/lib/backups/scheduler");
    startBackupScheduler();
    const { startInformeScheduler } = await import("@/lib/email/scheduler");
    startInformeScheduler();
  }
}

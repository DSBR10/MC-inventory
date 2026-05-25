export function getStatusStyle(status: string): string {
  const s = status.toLowerCase();

  if (["running", "available", "active", "ok"].includes(s)) {
    return `
      bg-[var(--success)]/20
      text-[var(--success)]
    `;
  }

  if (["stopped", "terminated", "shutoff"].includes(s)) {
    return `
      bg-[var(--error)]/20
      text-[var(--error)]
    `;
  }

  return `
    bg-gray-500/20
    text-[var(--text-secondary)]
  `;
}

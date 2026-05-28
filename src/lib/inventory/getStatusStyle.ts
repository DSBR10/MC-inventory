export function getStatusStyle(status: string): string {
  const s = status.toLowerCase();

  // Estados verdes (activos/habilitados)
  if (["running", "available", "active", "ok", "enabled"].includes(s)) {
    return `
      bg-[var(--success)]/20
      text-[var(--success)]
    `;
  }

  // Estados rojos (detenidos/deshabilitados/hibernados)
  if (["stopped", "terminated", "shutoff", "disabled", "hibernation"].includes(s)) {
    return `
      bg-[var(--error)]/20
      text-[var(--error)]
    `;
  }

  // Estados amarillos/warning (pendiente, en progreso)
  if (["pending", "creating", "updating", "deleting"].includes(s)) {
    return `
      bg-yellow-500/20
      text-yellow-600 dark:text-yellow-400
    `;
  }

  return `
    bg-gray-500/20
    text-[var(--text-secondary)]
  `;
}

/**
 * Normaliza el estado de un recurso.
 * Convierte "UNKNOWN" a "running" para evitar mostrar estados desconocidos.
 *
 * @param status - Estado original del recurso
 * @returns Estado normalizado
 */
export function normalizeStatus(status: string | undefined): string {
  if (!status) return "running";

  const normalized = status.toUpperCase();

  // UNKNOWN siempre se convierte a running
  if (normalized === "UNKNOWN") {
    return "running";
  }

  return status;
}

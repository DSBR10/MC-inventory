/**
 * Normaliza el estado de un recurso.
 * Preserva "UNKNOWN" para no dar falsa confianza de que el recurso está saludable.
 *
 * @param status - Estado original del recurso
 * @returns Estado normalizado
 */
export function normalizeStatus(status: string | undefined): string {
  if (!status) return "unknown";

  const normalized = status.toUpperCase();

  // Preservar UNKNOWN en vez de convertirlo a "running" — un recurso
  // con estado desconocido no debe aparecer como si estuviera activo.
  if (normalized === "UNKNOWN") {
    return "unknown";
  }

  return status;
}

export default function CommandHistory() {
  return (
    <div
      className="
        rounded-3xl
        border
        border-[var(--border)]
        bg-[var(--bg-card)]/60
        p-5
      "
    >
      <h2 className="text-xl font-semibold mb-4">Historial de comandos</h2>

      <div className="text-sm text-[var(--text-secondary)]">
        Sin ejecuciones recientes
      </div>
    </div>
  );
}

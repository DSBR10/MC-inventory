export default function ServerSelector() {
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
      <select
        className="
          w-full
          px-4
          py-3
          rounded-2xl
          bg-black/30
          border
          border-[var(--border)]
        "
      >
        <option>Seleccionar servidor</option>
      </select>
    </div>
  );
}

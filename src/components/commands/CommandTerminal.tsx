export default function CommandTerminal() {
  return (
    <div
      className="
        rounded-3xl
        border
        border-[var(--border)]
        bg-black
        overflow-hidden
      "
    >
      <div className="border-b border-[var(--border)] p-4">
        <h2 className="font-semibold">Terminal remota</h2>
      </div>

      <textarea
        placeholder="Escribe comandos aquí..."
        className="
          w-full
          h-[350px]
          bg-black
          text-green-400
          p-5
          outline-none
          font-mono
        "
      />
    </div>
  );
}

"use client";

type Props = {
  start: string;

  end: string;

  onStartChange: (value: string) => void;

  onEndChange: (value: string) => void;
};

export default function BillingDateFilters({
  start,
  end,
  onStartChange,
  onEndChange,
}: Props) {
  return (
    <div
      className="
        rounded-3xl
        border
        border-[var(--border)]
        bg-[#0B1220]
        p-5
      "
    >
      <div
        className="
          flex
          flex-wrap
          gap-4
          items-end
        "
      >
        <div className="flex flex-col gap-2">
          <label
            className="
              text-sm
              text-[var(--text-secondary)]
            "
          >
            Fecha Inicio
          </label>

          <input
            type="month"
            value={start}
            onChange={(e) => onStartChange(e.target.value)}
            className="
              bg-black/30
              border
              border-[var(--border)]
              rounded-2xl
              px-4
              py-3
              outline-none
              focus:border-cyan-500
            "
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            className="
              text-sm
              text-[var(--text-secondary)]
            "
          >
            Fecha Fin
          </label>

          <input
            type="month"
            value={end}
            onChange={(e) => onEndChange(e.target.value)}
            className="
              bg-black/30
              border
              border-[var(--border)]
              rounded-2xl
              px-4
              py-3
              outline-none
              focus:border-cyan-500
            "
          />
        </div>
      </div>
    </div>
  );
}

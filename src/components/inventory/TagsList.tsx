"use client";

import { formatTags } from "@/lib/inventory/formatTags";

export default function TagsList({
  tags
}: {
  tags?: Record<string, string>;
}) {

  const formatted = formatTags(tags);

  return (
    <div className="flex flex-wrap gap-1 min-w-0">
      {formatted.map((tag, index) => {
        const isNoTag = tag === "Sin tags";
        const [key, ...valParts] = tag.split(": ");
        const value = valParts.join(": ");

        return (
          <div
            key={`${tag}-${index}`}
            className={`
              inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border transition-all max-w-full
              ${isNoTag
                ? "bg-[var(--bg-hover)] text-[var(--text-secondary)] border-[var(--border)]"
                : "bg-[var(--primary)]/8 text-[var(--text-primary)] border-[var(--primary)]/15"
              }
            `}
          >
            {!isNoTag && (
              <span className="text-[var(--text-secondary)] font-medium uppercase tracking-wider text-[10px] flex-shrink-0">
                {key}:
              </span>
            )}
            <span className="truncate font-medium">
              {isNoTag ? tag : value}
            </span>
          </div>
        );
      })}
    </div>
  );

}
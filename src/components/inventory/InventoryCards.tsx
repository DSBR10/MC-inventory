import { InventoryItem } from "@/types/inventory";

import ServiceBadge from "./ServiceBadge";
import StatusBadge from "./StatusBadge";
import TagsList from "./TagsList";

type Props = {
  data: InventoryItem[];

  onSelect: (item: InventoryItem) => void;
};

export default function InventoryCards({ data, onSelect }: Props) {
  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div
          key={item.uniqueKey}
          onClick={() => onSelect(item)}
          className="
            bg-[var(--bg-card)]/60
            border
            border-[var(--border)]
            rounded-2xl
            p-4
            backdrop-blur-xl
            cursor-pointer
            interactive-button
            interactive-glow
            hover:border-[var(--primary)]/30
            hover:bg-[var(--bg-hover)]/30
          "
        >
          <div className="flex justify-between gap-4 mb-3">
            <div>
              <h3 className="font-bold text-base">{item.name}</h3>

              <p
                className="
                  text-[11px]
                  text-[var(--text-secondary)]
                  font-mono
                "
              >
                {item.id}
              </p>
            </div>

            <ServiceBadge service={item.service} />
          </div>

          <div className="flex items-center gap-3 mb-3">
            <StatusBadge status={item.status} />

            <span
              className="
                text-[11px]
                text-[var(--text-secondary)]
              "
            >
              {item.provider}
            </span>
          </div>

          <div className="mb-3">
            <p className="text-[11px] text-[var(--text-secondary)] mb-1">
              Network
            </p>

            <p className="text-sm">{item.host}</p>
          </div>

          {(item.securityGroups || []).length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] text-[var(--text-secondary)] mb-2">
                Security Groups
              </p>

              <div className="flex flex-wrap gap-2">
                {item.securityGroups?.slice(0, 2).map((sg) => (
                  <span
                    key={sg.id}
                    className="
                      px-2
                      py-1
                      rounded-lg
                      bg-yellow-500/10
                      text-yellow-400
                      text-[11px]
                    "
                  >
                    {sg.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <TagsList tags={item.tags} />
        </div>
      ))}
    </div>
  );
}

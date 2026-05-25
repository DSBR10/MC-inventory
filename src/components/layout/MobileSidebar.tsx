"use client";

import { Menu } from "lucide-react";

export default function MobileSidebar({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="
        lg:hidden
        w-11
        h-11
        rounded-xl
        border
        border-[var(--border)]
        bg-[var(--bg-card)]/60
        flex
        items-center
        justify-center
        hover:bg-[var(--bg-hover)]
        transition-all
      "
    >
      <Menu size={20} />
    </button>
  );
}

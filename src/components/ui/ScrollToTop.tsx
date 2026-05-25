"use client";

import { useEffect, useState } from "react";

import { ChevronUp } from "lucide-react";

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 350);
    };

    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <button
      onClick={scrollToTop}
      className={`
        interactive-button
        interactive-glow

        fixed
        bottom-6
        right-6
        z-50

        w-14
        h-14

        rounded-2xl

        border
        border-[var(--border)]

        backdrop-blur-xl

        flex
        items-center
        justify-center

        text-[var(--text-primary)]

        shadow-2xl

        transition-all
        duration-300

        ${
          visible
            ? `
              opacity-100
              translate-y-0
              pointer-events-auto
            `
            : `
              opacity-0
              translate-y-10
              pointer-events-none
            `
        }
      `}
      style={{
        background:
          "linear-gradient(135deg, var(--gradient-start), var(--gradient-end))",
      }}
    >
      <ChevronUp size={24} />
    </button>
  );
}

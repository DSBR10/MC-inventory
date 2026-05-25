"use client";

import { useEffect, useRef, useState } from "react";

import { useSession, signOut } from "next-auth/react";

import { useRouter } from "next/navigation";

import {
  LogOut,
  User,
  Palette,
  Shield,
  ChevronDown,
  Moon,
  Sun,
  Monitor,
} from "lucide-react";

import {
  useTheme,
  themeLabels,
  type ThemeName,
} from "@/app/providers/ThemeProvider";

const themes: {
  id: ThemeName;
  colors: string[];
}[] = [
  {
    id: "purple",
    colors: ["#8b5cf6", "#ec4899"],
  },
  {
    id: "ocean",
    colors: ["#06b6d4", "#14b8a6"],
  },
  {
    id: "sunset",
    colors: ["#f97316", "#ef4444"],
  },
  {
    id: "forest",
    colors: ["#10b981", "#14b8a6"],
  },
  {
    id: "midnight",
    colors: ["#6366f1", "#8b5cf6"],
  },
  {
    id: "cherry",
    colors: ["#f472b6", "#fb7185"],
  },
];

export default function UserMenu() {
  const { data: session } = useSession();

  const router = useRouter();

  const { theme, setTheme, appearance, setAppearance } = useTheme();

  const [open, setOpen] = useState(false);

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", handleClick);

    return () => window.removeEventListener("mousedown", handleClick);
  }, []);

  const user = session?.user;

  const role = user?.role || "infraestructura";

  const initial = user?.name?.charAt(0).toUpperCase() || "U";

  return (
    <div ref={ref} className="relative">
      {/* BUTTON */}

      <button
        onClick={() => setOpen(!open)}
        className="
          flex
          items-center
          gap-3
          px-3
          py-2
          rounded-2xl
          bg-[var(--bg-card)]/70
          border
          border-[var(--border)]
          hover:border-[var(--primary)]
          transition-all
          backdrop-blur-xl
        "
      >
        <div
          className="
            w-10
            h-10
            rounded-xl
            flex
            items-center
            justify-center
            text-[var(--text-primary)]
            font-bold
          "
          style={{
            background:
              "linear-gradient(135deg, var(--gradient-start), var(--gradient-end))",
          }}
        >
          {initial}
        </div>

        <div className="hidden md:block text-left">
          <p className="text-sm font-semibold">{user?.name}</p>

          <p className="text-xs text-[var(--text-secondary)]">{role}</p>
        </div>

        <ChevronDown
          size={16}
          className={`
            transition-transform
            ${open ? "rotate-180" : ""}
          `}
        />
      </button>

      {/* DROPDOWN */}

      {open && (
        <div
          className="
            absolute
            right-0
            top-16
            w-[360px]
            rounded-3xl
            border
            border-[var(--border)]
            bg-[var(--bg-card)]/95
            backdrop-blur-2xl
            shadow-2xl
            overflow-hidden
            z-50
            animate-fadeSlide
          "
        >
          {/* HEADER */}

          <div
            className="
              p-6
              border-b
              border-[var(--border)]
            "
          >
            <div className="flex items-center gap-4">
              <div
                className="
                  w-16
                  h-16
                  rounded-2xl
                  flex
                  items-center
                  justify-center
                  text-2xl
                  font-bold
                  text-[var(--text-primary)]
                "
                style={{
                  background:
                    "linear-gradient(135deg, var(--gradient-start), var(--gradient-end))",
                }}
              >
                {initial}
              </div>

              <div>
                <h3 className="font-bold text-lg">{user?.name}</h3>

                <p className="text-sm text-[var(--text-secondary)]">
                  {user?.email}
                </p>

                <div
                  className="
                    mt-2
                    inline-flex
                    items-center
                    gap-2
                    px-3
                    py-1
                    rounded-full
                    text-xs
                    bg-[var(--primary)]/10
                    text-[var(--primary)]
                    border
                    border-[var(--primary)]/20
                  "
                >
                  <Shield size={12} />

                  {role}
                </div>
              </div>
            </div>
          </div>

          {/* APPEARANCE */}

          <div className="p-6 border-b border-[var(--border)]">
            <div className="flex items-center gap-2 mb-4">
              <Palette size={16} />

              <p className="font-semibold">Apariencia</p>
            </div>

            {/* LIGHT DARK */}

            <div className="grid grid-cols-3 gap-2 mb-5">
              <button
                onClick={() => setAppearance("dark")}
                className={`
                  p-3
                  rounded-xl
                  border
                  flex
                  flex-col
                  items-center
                  gap-2
                  transition-all

                  ${
                    appearance === "dark"
                      ? "border-[var(--primary)] bg-[var(--primary)]/10"
                      : "border-[var(--border)]"
                  }
                `}
              >
                <Moon size={16} />

                <span className="text-xs">Dark</span>
              </button>

              <button
                onClick={() => setAppearance("light")}
                className={`
                  p-3
                  rounded-xl
                  border
                  flex
                  flex-col
                  items-center
                  gap-2
                  transition-all

                  ${
                    appearance === "light"
                      ? "border-[var(--primary)] bg-[var(--primary)]/10"
                      : "border-[var(--border)]"
                  }
                `}
              >
                <Sun size={16} />

                <span className="text-xs">Light</span>
              </button>

              <button
                onClick={() => setAppearance("system")}
                className={`
                  p-3
                  rounded-xl
                  border
                  flex
                  flex-col
                  items-center
                  gap-2
                  transition-all

                  ${
                    appearance === "system"
                      ? "border-[var(--primary)] bg-[var(--primary)]/10"
                      : "border-[var(--border)]"
                  }
                `}
              >
                <Monitor size={16} />

                <span className="text-xs">System</span>
              </button>
            </div>

            {/* THEMES */}

            <div className="grid grid-cols-3 gap-3">
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`
                    p-3
                    rounded-2xl
                    border
                    transition-all

                    ${
                      theme === t.id
                        ? "border-[var(--primary)] scale-105"
                        : "border-[var(--border)]"
                    }
                  `}
                >
                  <div className="flex gap-1 mb-2 justify-center">
                    {t.colors.map((c) => (
                      <div
                        key={c}
                        className="
                          w-5
                          h-5
                          rounded-full
                        "
                        style={{
                          background: c,
                        }}
                      />
                    ))}
                  </div>

                  <p className="text-xs">{themeLabels[t.id]}</p>
                </button>
              ))}
            </div>
          </div>

          {/* ACTIONS */}

          <div className="p-4 space-y-2">
            <button
              onClick={() => router.push("/profile")}
              className="
                w-full
                p-3
                rounded-2xl
                hover:bg-[var(--bg-hover)]
                flex
                items-center
                gap-3
                transition-all
              "
            >
              <User size={18} />
              Perfil
            </button>

            <button
              onClick={() =>
                signOut({
                  callbackUrl: "/login",
                })
              }
              className="
                w-full
                p-3
                rounded-2xl
                hover:bg-red-500/10
                text-red-400
                flex
                items-center
                gap-3
                transition-all
              "
            >
              <LogOut size={18} />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

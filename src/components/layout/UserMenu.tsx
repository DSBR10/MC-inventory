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
} from "@/app/providers/ThemeProvider";
import { ROLE_BADGE, ROLE_LABELS, THEMES, normalizeRole } from "@/lib/theme";

export default function UserMenu() {
  const { data: session } = useSession();

  const router = useRouter();

  const { theme, setTheme, appearance, setAppearance } = useTheme();

  const [open, setOpen] = useState(false);

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open ]);

  const navigate = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const user = session?.user;

  const role = normalizeRole(user?.role);

  const initial = user?.name?.charAt(0).toUpperCase() || "U";

  return (
    <div ref={ref} className="relative">

      <button
        type="button"
        data-audit-action="layout.user_menu.toggle"
        data-audit-label="Abrir menú de usuario"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Abrir menú de usuario"
        className="
          flex
          items-center
          gap-2.5
          px-2.5
          py-1.5
          rounded-lg
          border
          border-[var(--border)]
          hover:border-[var(--primary)]/40
          transition-all
        "
      >
        <div
          className="
            w-8
            h-8
            rounded-md
            flex
            items-center
            justify-center
            text-white
            text-sm
            font-semibold
          "
          style={{
            background: "linear-gradient(135deg, var(--gradient-start), var(--gradient-end))",
          }}
        >
          {initial}
        </div>

        <div className="hidden md:block text-left">
          <p className="text-xs font-medium">{user?.name}</p>
          <p className="text-[10px] text-[var(--text-secondary)]">{ROLE_LABELS[role]}</p>
        </div>

        <ChevronDown
          size={14}
          className={`text-[var(--text-secondary)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Menú de usuario"
          className="
            absolute
            right-0
            top-12
            w-[320px]
            max-w-[calc(100vw-2rem)]
            rounded-xl
            border
            border-[var(--border)]
            bg-[var(--bg-card)]
            shadow-2xl
            overflow-hidden
            z-50
            animate-fadeSlide
          "
        >

          <div className="p-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-3">
              <div
                className="
                  w-10
                  h-10
                  rounded-lg
                  flex
                  items-center
                  justify-center
                  text-sm
                  font-semibold
                  text-white
                "
                style={{
                  background: "linear-gradient(135deg, var(--gradient-start), var(--gradient-end))",
                }}
              >
                {initial}
              </div>

              <div>
                <p className="font-medium text-sm">{user?.name}</p>
                <p className="text-xs text-[var(--text-secondary)]">{user?.email}</p>
                <div
                  className={`
                    mt-1
                    inline-flex
                    items-center
                    gap-1.5
                    px-2
                    py-0.5
                    rounded
                    text-[10px]
                    border
                    ${ROLE_BADGE[role]}
                  `}
                >
                  <Shield size={10} />
                  {ROLE_LABELS[role]}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-2 mb-3">
              <Palette size={14} />
              <p className="text-sm font-medium">Apariencia</p>
            </div>

            <div className="grid grid-cols-3 gap-1.5 mb-4">
              <button
                type="button"
                data-audit-action="preference.appearance.change"
                data-audit-target="dark"
                onClick={() => setAppearance("dark")}
                className={`
                  p-2
                  rounded-lg
                  border
                  flex
                  flex-col
                  items-center
                  gap-1.5
                  transition-all
                  ${appearance === "dark"
                    ? "border-[var(--primary)] bg-[var(--primary)]/10"
                    : "border-[var(--border)]"
                  }
                `}
              >
                <Moon size={14} />
                <span className="text-[11px]">Dark</span>
              </button>

              <button
                type="button"
                data-audit-action="preference.appearance.change"
                data-audit-target="light"
                onClick={() => setAppearance("light")}
                className={`
                  p-2
                  rounded-lg
                  border
                  flex
                  flex-col
                  items-center
                  gap-1.5
                  transition-all
                  ${appearance === "light"
                    ? "border-[var(--primary)] bg-[var(--primary)]/10"
                    : "border-[var(--border)]"
                  }
                `}
              >
                <Sun size={14} />
                <span className="text-[11px]">Light</span>
              </button>

              <button
                type="button"
                data-audit-action="preference.appearance.change"
                data-audit-target="system"
                onClick={() => setAppearance("system")}
                className={`
                  p-2
                  rounded-lg
                  border
                  flex
                  flex-col
                  items-center
                  gap-1.5
                  transition-all
                  ${appearance === "system"
                    ? "border-[var(--primary)] bg-[var(--primary)]/10"
                    : "border-[var(--border)]"
                  }
                `}
              >
                <Monitor size={14} />
                <span className="text-[11px]">System</span>
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  data-audit-action="preference.theme.change"
                  data-audit-target={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`
                    p-2
                    rounded-lg
                    border
                    transition-all
                    ${theme === t.id
                      ? "border-[var(--primary)]"
                      : "border-[var(--border)]"
                    }
                  `}
                >
                  <div className="flex gap-0.5 mb-1.5 justify-center">
                    {t.colors.map((c) => (
                      <div
                        key={c}
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ background: c }}
                      />
                    ))}
                  </div>

                  <p className="truncate text-[10px] leading-tight" title={themeLabels[t.id]}>{themeLabels[t.id]}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 space-y-0.5">
            <button
              type="button"
              role="menuitem"
              data-audit-action="navigation.profile"
              onClick={() => navigate("/profile")}
              className="
                w-full
                p-2.5
                rounded-lg
                hover:bg-[var(--bg-hover)]
                flex
                items-center
                gap-2.5
                transition-all
                text-sm
              "
            >
              <User size={16} />
              Perfil
            </button>

            <button
              type="button"
              role="menuitem"
              data-audit-action="auth.logout.intent"
              onClick={() =>
                signOut({
                  callbackUrl: "/login",
                })
              }
              className="
                w-full
                p-2.5
                rounded-lg
                hover:bg-red-500/10
                text-red-400
                flex
                items-center
                gap-2.5
                transition-all
                text-sm
              "
            >
              <LogOut size={16} />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

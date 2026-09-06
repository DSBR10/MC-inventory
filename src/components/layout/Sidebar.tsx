"use client";

import Link from "next/link";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

import { Boxes, BarChart3, Terminal, DollarSign, ShieldCheck, X } from "lucide-react";
import BrandLogo from "@/components/layout/BrandLogo";
import { hasPermission, type Permission } from "@/lib/auth/roles";

const menuItems = [
  {
    label: "Inventario",
    href: "/",
    icon: Boxes,
  },

  {
    label: "Monitoreo",
    href: "/monitoreo",
    icon: BarChart3,
  },

  {
    label: "Comandos",
    href: "/comandos",
    icon: Terminal,
    permission: "command:execute" as Permission,
  },

  {
    label: "Billing",
    href: "/billing",
    icon: DollarSign,
  },
  {
    label: "Auditoría",
    href: "/auditoria",
    icon: ShieldCheck,
    permission: "audit:view" as Permission,
  },
];

export default function Sidebar({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;

  onClose: () => void;

  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const visibleItems = menuItems.filter(
    (item) => !item.permission || (session?.user?.role && hasPermission(session.user.role, item.permission)),
  );

  return (
    <aside
      className={`

        fixed
        top-0
        left-0

        h-screen
        w-[280px]

        z-50

        transition-all
        duration-300

        flex
        flex-col

        border-r
        border-[var(--border)]

        backdrop-blur-2xl

        bg-[var(--bg-card)]/92

        shadow-2xl

        ${open ? "translate-x-0" : "-translate-x-full"}

      `}
    >
      {/* HEADER */}

      <div
        className="

          h-16

          border-b
          border-[var(--border)]

          flex
          items-center
          justify-between

          px-5

        "
      >
        <div className="flex items-center gap-3">
          <BrandLogo />

          <div>
            <p
              className="

                font-bold
                text-[15px]

                text-[var(--text-primary)]

              "
            >
              MC Inventory
            </p>

            <p
              className="

                text-xs

                text-[var(--text-secondary)]

              "
            >
              UX Technology | Multi Cloud Inventory
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="

            w-9
            h-9

            rounded-xl

            border
            border-[var(--border)]

            bg-[var(--bg-hover)]/60

            flex
            items-center
            justify-center

            hover:scale-105

            transition-all

            interactive-button

          "
        >
          <X size={16} className="text-[var(--text-secondary)]" />
        </button>
      </div>

      {/* MENU */}

      <div
        className="

          flex-1

          p-4

          space-y-2

          overflow-y-auto

        "
      >
        {visibleItems.map((item) => {
          const Icon = item.icon;

          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                if (!active) onNavigate?.();
                onClose();
              }}
              className={`

                group

                relative

                flex
                items-center
                gap-3

                px-4
                py-3

                rounded-2xl

                transition-all
                duration-200

                border

                interactive-button

                ${
                  active
                    ? `

                      border-transparent

                      text-[var(--text-primary)]

                      shadow-lg

                    `
                    : `

                      border-transparent

                      text-[var(--text-secondary)]

                      hover:text-[var(--text-primary)]

                      hover:border-[var(--border)]

                      hover:bg-[var(--bg-hover)]/70

                    `
                }

              `}
              style={
                active
                  ? {
                      background: `linear-gradient(
                          135deg,
                          var(--gradient-start),
                          var(--gradient-end)
                        )`,
                    }
                  : {}
              }
            >
              {/* ACTIVE GLOW */}

              {active && (
                <div
                  className="

                    absolute
                    inset-0

                    rounded-2xl

                    opacity-20

                  "
                  style={{
                    background: `linear-gradient(
                        135deg,
                        var(--gradient-secondary-start),
                        var(--gradient-secondary-end)
                      )`,
                  }}
                />
              )}

              <Icon size={18} className="relative z-10" />

              <span
                className="

                  relative
                  z-10

                  font-medium
                  text-sm

                "
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* FOOTER */}

      <div
        className="

          border-t
          border-[var(--border)]

          px-5
          py-4

        "
      >
        <div
          className="

            flex
            items-center
            justify-between

          "
        >
          <div>
            <p
              className="

                text-xs
                font-semibold

                text-[var(--text-primary)]

              "
            >
              MC Inventory
            </p>

            <p
              className="

                text-[11px]

                text-[var(--text-secondary)]

              "
            >
              Enterprise FinOps Platform
            </p>
          </div>

          <div
            className="

              px-2.5
              py-1

              rounded-lg

              border
              border-[var(--border)]

              bg-[var(--bg-hover)]/70

              text-[10px]
              font-semibold

              text-[var(--text-secondary)]

            "
          >
            v9.0
          </div>
        </div>
      </div>
    </aside>
  );
}

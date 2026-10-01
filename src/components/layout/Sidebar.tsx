"use client";

import Link from "next/link";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

import { LayoutDashboard, Boxes, BarChart3, Server, Archive, Terminal, DollarSign, ShieldCheck, X, FileBarChart } from "lucide-react";
import BrandLogo from "@/components/layout/BrandLogo";
import { hasPermission, type Permission } from "@/lib/auth/roles";

const menuSections = [
  {
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        label: "Inventario",
        href: "/",
        icon: Boxes,
      },
    ],
  },
  {
    items: [
      {
        label: "Monitoreo",
        href: "/monitoreo",
        icon: BarChart3,
      },
      {
        label: "Servidores",
        href: "/servidores",
        icon: Server,
      },
      {
        label: "Backups",
        href: "/backups",
        icon: Archive,
      },
      {
        label: "Informes",
        href: "/informes",
        icon: FileBarChart,
      },
    ],
  },
  {
    items: [
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
    ],
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

  return (
    <aside
      className={`
        fixed
        top-0
        left-0
        h-screen
        w-[280px]
        z-50
        transition-transform
        duration-300
        ease-in-out
        flex
        flex-col
        border-r
        border-[var(--border)]
        bg-[var(--bg-card)]
        ${open ? "translate-x-0" : "-translate-x-full"}
      `}
    >

      <div className="h-14 border-b border-[var(--border)] flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <BrandLogo />
          <div>
            <p className="font-semibold text-sm text-[var(--text-primary)]">
              MC Inventory
            </p>
            <p className="text-[11px] text-[var(--text-secondary)]">
              UX Technology
            </p>
          </div>
        </div>

        <button
          type="button"
          data-audit-action="layout.sidebar.close"
          data-audit-label="Cerrar menú lateral"
          onClick={onClose}
          className="
            w-7
            h-7
            rounded-md
            flex
            items-center
            justify-center
            text-[var(--text-secondary)]
            hover:text-[var(--text-primary)]
            hover:bg-[var(--bg-hover)]
            transition-all
          "
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 py-3 overflow-y-auto">
        {menuSections.map((section, si) => (
          <div key={si}>
            {si > 0 && (
              <div className="mx-4 my-2 border-t border-[var(--border)]" />
            )}
            <div className="px-2 space-y-0.5">
              {section.items
                .filter((item) => !item.permission || (session?.user?.role && hasPermission(session.user.role, item.permission)))
                .map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      data-audit-action="navigation.sidebar"
                      data-audit-label={item.label}
                      data-audit-target={item.label.toLowerCase()}
                      onClick={() => {
                        if (!active) onNavigate?.();
                        onClose();
                      }}
                      className={`
                        relative
                        flex
                        items-center
                        gap-3
                        px-3
                        py-2.5
                        rounded-lg
                        transition-all
                        duration-150
                        ${active
                          ? "text-[var(--text-primary)] bg-[var(--bg-hover)]"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]/50"
                        }
                      `}
                    >
                      {active && (
                        <div
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[var(--primary)]"
                        />
                      )}
                      <Icon size={17} className={active ? "text-[var(--primary)]" : ""} />
                      <span className="font-medium text-sm">{item.label}</span>
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--border)] px-4 py-3 flex items-center justify-between">
        <p className="text-[11px] text-[var(--text-secondary)]">
          MC Inventory
        </p>
        <span className="px-1.5 py-0.5 rounded text-[10px] text-[var(--text-secondary)] bg-[var(--bg-hover)]">
          v10.7
        </span>
      </div>
    </aside>
  );
}

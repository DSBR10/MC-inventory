"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft, CheckCircle2, LogOut } from "lucide-react";

import type { Role } from "@/lib/auth/roles";
import { useTheme, themeLabels } from "@/app/providers/ThemeProvider";
import { ROLE_BADGE, ROLE_GRADIENT, ROLE_LABELS, THEMES, normalizeRole } from "@/lib/theme";

const roleDescriptions: Record<Role, string[]> = {
  admin: [
    "Acceso completo a inventario, monitoreo y billing",
    "Puede ejecutar comandos remotos en EC2",
    "Puede editar metadata y administrar operaciones sensibles",
  ],
  plataformas: [
    "Puede ver inventario, dashboard y monitoreo",
    "Puede exportar información",
    "No puede modificar metadata ni ejecutar comandos remotos",
  ],
  operaciones: [
    "Puede ver dashboard y monitoreo",
    "Sin acceso a billing",
    "Sin permisos de modificacion",
  ],
  audit: [
    "Puede ver inventario",
    "Sin acceso a comandos remotos ni billing",
  ],
};

const roleAccessSummary: Record<Role, string> = {
  admin: "Acceso completo",
  plataformas: "Acceso operativo",
  operaciones: "Acceso de monitoreo",
  audit: "Acceso de consulta",
};

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { theme, themeName, setTheme } = useTheme();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [router, status]);

  useEffect(() => {
    if (!session?.user) return;
    // El último acceso siempre refleja la sesión actual (nunca stale).
    if (session.user.lastLogin) {
      localStorage.setItem("last-login", session.user.lastLogin);
    } else if (!localStorage.getItem("last-login")) {
      localStorage.setItem("last-login", new Date().toISOString());
    }
  }, [session]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[var(--bg-dark)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--text-secondary)]">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  if (!session?.user) return null;

  const userRole = normalizeRole(session.user.role);
  const lastLogin = session.user.lastLogin;
  const userInitial = session.user.name?.charAt(0).toUpperCase() || "U";
  const userEmail = session.user.email || "usuario@ejemplo.com";
  const userName = session.user.name || "Usuario";

  return (
    <main className="min-h-screen bg-[var(--bg-dark)]">
      <div className="border-b border-[var(--border)] bg-[var(--bg-card)]/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="h-4 w-4" /> Volver al Dashboard
          </button>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--error)]/10 text-[var(--error)] hover:bg-[var(--error)]/20 transition-colors border border-[var(--error)]/20"
          >
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <section className="bg-[var(--bg-card)]/50 backdrop-blur-sm rounded-2xl border border-[var(--border)] overflow-hidden shadow-2xl">
          <div className="h-32 sm:h-40" style={{ background: ROLE_GRADIENT[userRole] }} />

          <div className="px-6 sm:px-8 pb-8 sm:pb-10">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 -mt-12 sm:-mt-16 mb-8">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl flex items-center justify-center shadow-xl border-4 border-white/90" style={{ background: ROLE_GRADIENT[userRole] }}>
                <span className="text-4xl sm:text-5xl font-bold text-white">
                  {userInitial}
                </span>
              </div>

              <div className="flex-1">
                <h1 className="text-2xl sm:text-4xl font-bold text-[var(--text-primary)] mb-2">
                  {userName}
                </h1>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm border ${ROLE_BADGE[userRole]}`}>
                  {ROLE_LABELS[userRole]}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <InfoCard label="Correo electrónico" value={userEmail} />
              <InfoCard
                label="Último acceso"
                value={lastLogin ? new Date(lastLogin).toLocaleString() : "Primera vez"}
              />
              <InfoCard label="Nivel de acceso" value={roleAccessSummary[userRole]} />
            </div>

            <div className="border-t border-[var(--border)] my-6" />

            <section>
              <h2 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)] mb-4">
                Permisos del rol
              </h2>
              <div className="bg-[var(--bg-hover)]/30 rounded-xl p-4 sm:p-6 border border-[var(--border)]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {roleDescriptions[userRole].map((permission) => (
                    <p key={permission} className="flex items-start gap-2 text-sm sm:text-base text-[var(--text-secondary)]">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span>{permission}</span>
                    </p>
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-8">
              <h2 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)] mb-4">
                Personalizar tema
              </h2>
              <div className="bg-[var(--bg-hover)]/30 rounded-xl p-4 sm:p-6 border border-[var(--border)]">
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  Tema actual: <span className="text-[var(--text-primary)] font-medium">{themeName}</span>
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3">
                  {THEMES.map((item) => {
                    const selected = theme === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTheme(item.id)}
                        aria-pressed={selected}
                        title={themeLabels[item.id]}
                        className={`group relative overflow-hidden rounded-xl transition-all ${
                          selected ? "ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--bg-card)] shadow-lg scale-[1.03]" : "hover:scale-105 hover:shadow-xl"
                        }`}
                        style={{ background: `linear-gradient(135deg, ${item.colors[0]}, ${item.colors[1]})` }}
                      >
                        <span className="flex flex-col items-center gap-1.5 px-2 py-3">
                          <span className="flex justify-center gap-1">
                            {item.colors.map((color) => (
                              <span key={color} className="h-3.5 w-3.5 rounded-full border border-white/40" style={{ backgroundColor: color }} />
                            ))}
                          </span>
                          <span className="truncate text-[11px] font-semibold text-white drop-shadow">
                            {themeLabels[item.id]}
                          </span>
                          {selected && <CheckCircle2 className="h-4 w-4 text-white drop-shadow" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-xl bg-[var(--bg-hover)]/50 border border-[var(--border)]">
      <p className="text-xs text-[var(--text-secondary)]">{label}</p>
      <p className="text-sm sm:text-base text-[var(--text-primary)] break-words">{value}</p>
    </div>
  );
}

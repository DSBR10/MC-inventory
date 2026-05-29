"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import type { Role } from "@/lib/auth/roles";
import { useTheme, themeLabels, type ThemeName } from "../providers/ThemeProvider";

const roleLabels: Record<Role, string> = {
  admin: "Administrador",
  plataformas: "Plataformas",
  operaciones: "Operaciones",
  audit: "Auditoria",
};

const roleDescriptions: Record<Role, string[]> = {
  admin: [
    "Acceso completo a inventario, monitoreo y billing",
    "Puede ejecutar comandos remotos en EC2",
    "Puede editar metadata y administrar operaciones sensibles",
  ],
  plataformas: [
    "Puede ver inventario, dashboard y monitoreo",
    "Puede exportar informacion",
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

const roleColors: Record<Role, string> = {
  admin: "bg-gradient-to-r from-purple-600 to-indigo-600",
  plataformas: "bg-gradient-to-r from-blue-600 to-cyan-600",
  operaciones: "bg-gradient-to-r from-green-600 to-emerald-600",
  audit: "bg-gradient-to-r from-yellow-600 to-amber-600",
};

const roleBadgeColors: Record<Role, string> = {
  admin: "bg-purple-500/20 text-purple-400 border-purple-500",
  plataformas: "bg-blue-500/20 text-blue-400 border-blue-500",
  operaciones: "bg-green-500/20 text-green-400 border-green-500",
  audit: "bg-yellow-500/20 text-yellow-400 border-yellow-500",
};

const themes: { id: ThemeName; colors: string[] }[] = [
  { id: "purple", colors: ["#8b5cf6", "#ec4899", "#d946ef"] },
  { id: "ocean", colors: ["#06b6d4", "#14b8a6", "#2dd4bf"] },
  { id: "sunset", colors: ["#f97316", "#ef4444", "#ec4899"] },
  { id: "forest", colors: ["#10b981", "#14b8a6", "#6ee7b7"] },
  { id: "midnight", colors: ["#6366f1", "#8b5cf6", "#c084fc"] },
  { id: "cherry", colors: ["#f472b6", "#fb7185", "#f43f5e"] },
];

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

    const stored = localStorage.getItem("last-login");
    const nextValue = stored || session.user.lastLogin || new Date().toISOString();

    if (!stored) {
      localStorage.setItem("last-login", nextValue);
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

  const userRole = session.user.role || "audit";
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
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Volver al Dashboard
          </button>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="px-4 py-2 rounded-lg bg-[var(--error)]/10 text-[var(--error)] hover:bg-[var(--error)]/20 transition-colors border border-[var(--error)]/20"
          >
            Cerrar sesion
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <section className="bg-[var(--bg-card)]/50 backdrop-blur-sm rounded-2xl border border-[var(--border)] overflow-hidden shadow-2xl">
          <div className={`h-32 sm:h-40 ${roleColors[userRole]}`} />

          <div className="px-6 sm:px-8 pb-8 sm:pb-10">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 -mt-12 sm:-mt-16 mb-8">
              <div className={`w-24 h-24 sm:w-32 sm:h-32 rounded-2xl ${roleColors[userRole]} flex items-center justify-center shadow-xl border-4 border-[var(--bg-card)]`}>
                <span className="text-4xl sm:text-5xl font-bold text-[var(--text-primary)]">
                  {userInitial}
                </span>
              </div>

              <div className="flex-1">
                <h1 className="text-2xl sm:text-4xl font-bold text-[var(--text-primary)] mb-2">
                  {userName}
                </h1>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm border ${roleBadgeColors[userRole]}`}>
                  {roleLabels[userRole]}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <InfoCard label="Correo electronico" value={userEmail} />
              <InfoCard
                label="Ultimo acceso"
                value={lastLogin ? new Date(lastLogin).toLocaleString() : "Primera vez"}
              />
            </div>

            <div className="border-t border-[var(--border)] my-6" />

            <section>
              <h2 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)] mb-4">
                Permisos del rol
              </h2>
              <div className="bg-[var(--bg-hover)]/30 rounded-xl p-4 sm:p-6 border border-[var(--border)]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {roleDescriptions[userRole].map((permission) => (
                    <p key={permission} className="text-sm sm:text-base text-[var(--text-secondary)]">
                      {permission}
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

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                  {themes.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setTheme(item.id)}
                      className={`group relative p-4 rounded-xl transition-all ${
                        theme === item.id ? "ring-2 ring-white shadow-lg scale-105" : "hover:scale-105 hover:shadow-xl"
                      }`}
                      style={{
                        background: `linear-gradient(135deg, ${item.colors[0]}, ${item.colors[1]})`,
                      }}
                    >
                      <div className="relative z-10">
                        <div className="flex justify-center gap-1 mb-2">
                          {item.colors.map((color) => (
                            <div key={color} className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                          ))}
                        </div>
                        <p className="text-xs font-medium text-[var(--text-primary)] text-center">
                          {themeLabels[item.id]}
                        </p>
                      </div>
                    </button>
                  ))}
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

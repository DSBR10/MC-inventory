"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme, themeLabels } from "../providers/ThemeProvider";
import type { ThemeName } from "../providers/ThemeProvider";

type UserRole =
  | "admin"
  | "infraestructura"
  | "telecomunicaciones"
  | "basedatos"
  | "seguridad";

const roleLabels: Record<UserRole, string> = {
  admin: "Administrador",
  infraestructura: "Infraestructura",
  telecomunicaciones: "Telecomunicaciones",
  basedatos: "Base de Datos",
  seguridad: "Seguridad de Plataformas",
};

const roleDescriptions: Record<UserRole, string[]> = {
  admin: [
    "✅ Acceso completo a todos los servicios AWS",
    "✅ Ejecutar comandos en EC2",
    "✅ Ver y editar metadata",
    "✅ Exportar inventario",
  ],
  infraestructura: [
    "✅ Ver todos los servicios (EC2, RDS, S3, VPC, Subnet)",
    "✅ Ejecutar comandos en EC2",
    "✅ Exportar inventario",
    "⚠️ No puede editar metadata",
  ],
  telecomunicaciones: [
    "✅ Ver VPC y Subnets",
    "✅ Exportar inventario",
    "⚠️ No puede ejecutar comandos en EC2",
    "⚠️ No ve otros servicios",
  ],
  basedatos: [
    "✅ Ver RDS",
    "✅ Exportar inventario",
    "⚠️ No puede ejecutar comandos en EC2",
    "⚠️ No ve otros servicios",
  ],
  seguridad: [
    "✅ Ver Security Groups (próximamente)",
    "⚠️ Funcionalidad en desarrollo",
  ],
};

const roleColors: Record<UserRole, string> = {
  admin: "bg-gradient-to-r from-purple-600 to-indigo-600",
  infraestructura: "bg-gradient-to-r from-blue-600 to-cyan-600",
  telecomunicaciones: "bg-gradient-to-r from-green-600 to-emerald-600",
  basedatos: "bg-gradient-to-r from-yellow-600 to-amber-600",
  seguridad: "bg-gradient-to-r from-red-600 to-rose-600",
};

const roleBadgeColors: Record<UserRole, string> = {
  admin: "bg-purple-500/20 text-purple-400 border-purple-500",
  infraestructura: "bg-blue-500/20 text-blue-400 border-blue-500",
  telecomunicaciones: "bg-green-500/20 text-green-400 border-green-500",
  basedatos: "bg-yellow-500/20 text-yellow-400 border-yellow-500",
  seguridad: "bg-red-500/20 text-red-400 border-red-500",
};

// Temas disponibles con sus colores de preview
const themes: { id: ThemeName; colors: string[] }[] = [
  { id: "purple", colors: ["#8b5cf6", "#ec4899", "#d946ef"] },
  { id: "ocean", colors: ["#06b6d4", "#14b8a6", "#2dd4bf"] },
  { id: "sunset", colors: ["#f97316", "#ef4444", "#ec4899"] },
  { id: "forest", colors: ["#10b981", "#14b8a6", "#6ee7b7"] },
  { id: "midnight", colors: ["#6366f1", "#8b5cf6", "#c084fc"] },
  { id: "cherry", colors: ["#f472b6", "#fb7185", "#f43f5e"] },
];

export default function ProfilePage() {
  const [mounted, setMounted] = useState(false);
  const { data: session, status } = useSession();
  const router = useRouter();
  const [lastLoginLocal, setLastLoginLocal] = useState<string>("");

  // Solo usar useTheme después de montado
  let theme = "purple";
  let themeName = "Purple Passion";
  let setTheme = (t: ThemeName) => {};

  try {
    const themeHook = useTheme();
    if (mounted) {
      theme = themeHook.theme;
      themeName = themeHook.themeName;
      setTheme = themeHook.setTheme;
    }
  } catch (e) {
    // Ignorar error durante SSR
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }

    const stored = localStorage.getItem("last-login");
    if (stored) {
      setLastLoginLocal(stored);
    } else if (session?.user?.lastLogin) {
      setLastLoginLocal(session.user.lastLogin);
    } else {
      const now = new Date().toISOString();
      localStorage.setItem("last-login", now);
      setLastLoginLocal(now);
    }
  }, [status, router, session]);

  if (!mounted || status === "loading") {
    return (
      <div className="min-h-screen bg-[var(--bg-dark)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[var(--text-secondary)]">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  const userRole = (session.user.role || "infraestructura") as UserRole;
  const lastLogin = session.user.lastLogin || lastLoginLocal;
  const userInitial = session.user.name?.charAt(0).toUpperCase() || "U";
  const userEmail = session.user.email || "usuario@ejemplo.com";
  const userName = session.user.name || "Usuario";

  return (
    <main
      className="min-h-screen"
      style={{
        background: `linear-gradient(135deg, var(--bg-dark) 0%, var(--bg-card) 100%)`,
      }}
    >
      {/* Header con navegación */}
      <div className="border-b border-[var(--border)] bg-[var(--bg-card)]/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Volver al Dashboard
            </button>

            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--error)]/10 text-[var(--error)] hover:bg-[var(--error)]/20 transition-colors border border-[var(--error)]/20"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Tarjeta de perfil */}
        <div className="bg-[var(--bg-card)]/50 backdrop-blur-sm rounded-2xl border border-[var(--border)] overflow-hidden shadow-2xl">
          {/* Banner decorativo con gradiente según rol */}
          <div className={`h-32 sm:h-40 ${roleColors[userRole]}`}></div>

          {/* Información del usuario - SIN superposición */}
          <div className="px-6 sm:px-8 pb-8 sm:pb-10">
            {/* Avatar y nombre - layout responsive */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 -mt-12 sm:-mt-16 mb-6 sm:mb-8">
              {/* Avatar */}
              <div
                className={`w-24 h-24 sm:w-32 sm:h-32 rounded-2xl ${roleColors[userRole]} flex items-center justify-center shadow-xl border-4 border-[var(--bg-card)]`}
              >
                <span className="text-4xl sm:text-5xl font-bold text-[var(--text-primary)]">
                  {userInitial}
                </span>
              </div>

              {/* Nombre y rol */}
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-2">
                  {userName}
                </h1>
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm border ${roleBadgeColors[userRole]}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-current"></span>
                    {roleLabels[userRole]}
                  </span>
                </div>
              </div>
            </div>

            {/* Información de contacto */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--bg-hover)]/50 border border-[var(--border)]">
                <div className="w-10 h-10 rounded-lg bg-[var(--info)]/20 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-[var(--info)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Correo electrónico
                  </p>
                  <p className="text-sm sm:text-base text-[var(--text-primary)]">
                    {userEmail}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--bg-hover)]/50 border border-[var(--border)]">
                <div className="w-10 h-10 rounded-lg bg-[var(--success)]/20 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-[var(--success)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Último acceso
                  </p>
                  <p className="text-sm sm:text-base text-[var(--text-primary)]">
                    {lastLogin
                      ? new Date(lastLogin).toLocaleString()
                      : "Primera vez"}
                  </p>
                </div>
              </div>
            </div>

            {/* Línea divisoria */}
            <div className="border-t border-[var(--border)] my-6"></div>

            {/* Permisos del rol */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <svg
                  className="w-5 h-5 text-[var(--text-secondary)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <h2 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)]">
                  Permisos del Rol
                </h2>
              </div>

              <div className="bg-[var(--bg-hover)]/30 rounded-xl p-4 sm:p-6 border border-[var(--border)]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {roleDescriptions[userRole].map((permission, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-sm sm:text-base"
                    >
                      <span className="text-[var(--text-secondary)]">
                        {permission}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Selector de temas */}
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-4">
                <svg
                  className="w-5 h-5 text-[var(--text-secondary)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                  />
                </svg>
                <h2 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)]">
                  Personalizar tema
                </h2>
              </div>

              <div className="bg-[var(--bg-hover)]/30 rounded-xl p-4 sm:p-6 border border-[var(--border)]">
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  Tema actual:{" "}
                  <span className="text-[var(--text-primary)] font-medium">
                    {themeName}
                  </span>
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                  {themes.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`group relative p-4 rounded-xl transition-all ${
                        theme === t.id
                          ? "ring-2 ring-white shadow-lg scale-105"
                          : "hover:scale-105 hover:shadow-xl"
                      }`}
                      style={{
                        background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})`,
                      }}
                    >
                      <div className="absolute inset-0 rounded-xl bg-black/20 group-hover:bg-black/10 transition-all"></div>
                      <div className="relative z-10">
                        <div className="flex justify-center gap-1 mb-2">
                          {t.colors.map((color, idx) => (
                            <div
                              key={idx}
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: color }}
                            ></div>
                          ))}
                        </div>
                        <p className="text-xs font-medium text-[var(--text-primary)] text-center">
                          {themeLabels[t.id]}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                <p className="text-xs text-[var(--text-secondary)] mt-4 text-center">
                  El tema se guarda automáticamente y se aplica a toda la
                  aplicación
                </p>
              </div>
            </div>

            {/* Información adicional */}
            <div className="mt-8 p-4 rounded-xl bg-[var(--bg-hover)]/20 border border-[var(--border)]">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-[var(--text-secondary)]">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  <span>ID de sesión: {session.user.id || "N/A"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span>MC Inventory v5.0</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

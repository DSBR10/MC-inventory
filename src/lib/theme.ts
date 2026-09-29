import type { ThemeName } from "@/app/providers/ThemeProvider";
import type { Role } from "@/lib/auth/roles";

// Única fuente de verdad para temas y roles (Profile + UserMenu).
export const THEMES: Array<{ id: ThemeName; colors: [string, string] }> = [
  { id: "slate", colors: ["#6366f1", "#818cf8"] },
  { id: "purple", colors: ["#8b5cf6", "#ec4899"] },
  { id: "ocean", colors: ["#06b6d4", "#14b8a6"] },
  { id: "sunset", colors: ["#f97316", "#ef4444"] },
  { id: "forest", colors: ["#10b981", "#14b8a6"] },
  { id: "midnight", colors: ["#6366f1", "#8b5cf6"] },
  { id: "cherry", colors: ["#f472b6", "#fb7185"] },
];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  plataformas: "Plataformas",
  operaciones: "Operaciones",
  audit: "Auditoría",
};

export const ROLE_BADGE: Record<Role, string> = {
  admin: "bg-red-500/15 text-red-300 border-red-500/30",
  plataformas: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  operaciones: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  audit: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

export const ROLE_GRADIENT: Record<Role, string> = {
  admin: "linear-gradient(135deg, #ef4444, #f97316)",
  plataformas: "linear-gradient(135deg, #3b82f6, #06b6d4)",
  operaciones: "linear-gradient(135deg, #10b981, #14b8a6)",
  audit: "linear-gradient(135deg, #f59e0b, #eab308)",
};

export function normalizeRole(role: unknown): Role {
  return role === "admin" || role === "plataformas" || role === "operaciones" || role === "audit"
    ? role
    : "audit";
}

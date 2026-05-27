// Role-Based Access Control (RBAC) System

export type Role = "admin" | "plataformas" | "operaciones" | "audit";

export type Permission =
  | "inventory:view"
  | "inventory:modify"
  | "dashboard:view"
  | "monitoring:view"
  | "billing:view"
  | "billing:modify"
  | "settings:view"
  | "settings:modify"
  | "users:view"
  | "export:csv";

export const GROUP_ROLE_MAP: Record<string, Role> = {
  UX_INVENTORY: "admin",
  UX_INVENTORY_PLATAFORMAS: "plataformas",
  UX_INVENTORY_OPERACIONES: "operaciones",
  UX_INVENTORY_AUDIT: "audit",
};

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    "inventory:view",
    "inventory:modify",
    "dashboard:view",
    "monitoring:view",
    "billing:view",
    "billing:modify",
    "settings:view",
    "settings:modify",
    "users:view",
    "export:csv",
  ],
  plataformas: [
    "inventory:view",
    "dashboard:view",
    "monitoring:view",
    "export:csv",
  ],
  operaciones: [
    "dashboard:view",
    "monitoring:view",
  ],
  audit: [
    "inventory:view",
  ],
};

export const ROLE_INFO: Record<Role, { label: string; description: string; color: string }> = {
  admin: {
    label: "Administrador",
    description: "Acceso total a todos los servicios y gestion de la plataforma",
    color: "#ef4444",
  },
  plataformas: {
    label: "Plataformas",
    description: "Visualizacion de todos los servicios excepto Billing. Sin permisos de modificacion",
    color: "#f59e0b",
  },
  operaciones: {
    label: "Operaciones",
    description: "Solo visualizacion del dashboard y monitoreo",
    color: "#06b6d4",
  },
  audit: {
    label: "Auditoria",
    description: "Solo visualizacion del inventario",
    color: "#8b5cf6",
  },
};

export function mapGroupsToRole(groups: string[]): Role {
  if (groups.includes("UX_INVENTORY")) return "admin";
  if (groups.includes("UX_INVENTORY_PLATAFORMAS")) return "plataformas";
  if (groups.includes("UX_INVENTORY_OPERACIONES")) return "operaciones";
  if (groups.includes("UX_INVENTORY_AUDIT")) return "audit";
  return "audit";
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getPermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function canAccessSection(
  role: Role,
  section: "inventory" | "dashboard" | "monitoring" | "billing" | "settings"
): boolean {
  const sectionPermissions: Record<string, Permission> = {
    inventory: "inventory:view",
    dashboard: "dashboard:view",
    monitoring: "monitoring:view",
    billing: "billing:view",
    settings: "settings:view",
  };
  return hasPermission(role, sectionPermissions[section]);
}

export function isAdmin(role: Role): boolean {
  return role === "admin";
}

export function canModify(role: Role): boolean {
  return hasPermission(role, "inventory:modify");
}
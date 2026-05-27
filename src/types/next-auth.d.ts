import "next-auth";
import { Role, Permission } from "@/lib/auth/roles";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      image?: string;
      role: Role;
      permissions: Permission[];
      groups: string[];
    };
  }
  interface User {
    role: Role;
    permissions: Permission[];
    groups: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role;
    permissions: Permission[];
    groups: string[];
  }
}
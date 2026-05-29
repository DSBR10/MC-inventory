import type { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";

import { getPermissions, mapGroupsToRole, type Role } from "@/lib/auth/roles";

function parseCsv(value?: string) {
  return (value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedEmail(email?: string | null) {
  const allowedUsers = parseCsv(process.env.ALLOWED_USERS);
  if (allowedUsers.length === 0) return true;
  return !!email && allowedUsers.includes(email.toLowerCase());
}

function getUserRole(email?: string | null, groups: string[] = []): Role {
  const emailLower = email?.toLowerCase() || "";
  const adminEmails = parseCsv(process.env.ADMIN_EMAILS);

  if (adminEmails.includes(emailLower)) return "admin";
  if (groups.length > 0) return mapGroupsToRole(groups);
  if (emailLower.includes("admin") || emailLower.includes("administrator")) {
    return "admin";
  }
  if (
    emailLower.includes("infra") ||
    emailLower.includes("devops") ||
    emailLower.includes("sysops")
  ) {
    return "plataformas";
  }
  if (
    emailLower.includes("ops") ||
    emailLower.includes("operacion") ||
    emailLower.includes("operaciones")
  ) {
    return "operaciones";
  }

  return "audit";
}

function getProfileEmail(profile: unknown, fallback?: string | null) {
  if (profile && typeof profile === "object") {
    const candidate = profile as { email?: string; preferred_username?: string };
    return candidate.email || candidate.preferred_username || fallback || null;
  }

  return fallback || null;
}

function getProfileGroups(profile: unknown) {
  if (profile && typeof profile === "object") {
    const candidate = profile as { groups?: unknown };
    return Array.isArray(candidate.groups)
      ? candidate.groups.filter((group): group is string => typeof group === "string")
      : [];
  }

  return [];
}

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID || "",
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET || "",
      tenantId: process.env.AZURE_AD_TENANT_ID || "",
    }),
    CredentialsProvider({
      name: "Local",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const user = process.env.LOCAL_ADMIN_USER;
        const pass = process.env.LOCAL_ADMIN_PASSWORD;

        if (user && pass && credentials?.username === user && credentials?.password === pass) {
          return {
            id: "local-admin",
            name: "Administrator",
            email: "admin@ux.local",
            role: "admin" as Role,
            permissions: getPermissions("admin"),
            groups: ["UX_INVENTORY"],
          };
        }

        return null;
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, profile }) {
      const email = getProfileEmail(profile, user.email);
      return isAllowedEmail(email);
    },
    async jwt({ token, user, account, profile }) {
      if (user) {
        const role = (user.role as Role | undefined) || getUserRole(user.email);
        token.role = role;
        token.permissions = getPermissions(role);
        token.groups = (user.groups as string[] | undefined) || [];
        token.lastLogin = new Date().toISOString();
      }

      if (account?.provider === "azure-ad") {
        const email = getProfileEmail(profile, token.email);
        const groups = getProfileGroups(profile);
        const role = getUserRole(email, groups);
        token.email = email || token.email;
        token.role = role;
        token.permissions = getPermissions(role);
        token.groups = groups;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || "";
        session.user.email = token.email || "";
        session.user.role = (token.role as Role | undefined) || "audit";
        session.user.permissions = token.permissions || getPermissions(session.user.role);
        session.user.groups = token.groups || [];
        session.user.lastLogin = token.lastLogin as string | undefined;
      }

      return session;
    },
  },
};

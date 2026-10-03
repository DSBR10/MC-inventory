import type { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";

import { evaluateAzureAdAccess, getProfileEmails, isInAllowedAzureAdGroup } from "@/lib/auth/access";
import { getRequestContext, recordAuditEvent } from "@/lib/audit/server";
import { getPermissions, mapGroupsToRole, type GroupRoleMap, type Role } from "@/lib/auth/roles";
import { isPasswordHash, resolveSecret, verifyPassword } from "@/lib/secrets/crypto";

function parseCsv(value?: string) {
  return (value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function parseList(...values: Array<string | undefined>) {
  return values
    .flatMap((value) => (value || "").split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildEnvGroupRoleMap(): GroupRoleMap {
  const entries: Array<[Role, string[]]> = [
    ["admin", parseList(process.env.ROLE_ADMIN_GROUPS, process.env.AZURE_AD_ADMIN_GROUPS)],
    ["plataformas", parseList(process.env.ROLE_PLATAFORMAS_GROUPS, process.env.AZURE_AD_PLATAFORMAS_GROUPS)],
    ["operaciones", parseList(process.env.ROLE_OPERACIONES_GROUPS, process.env.AZURE_AD_OPERACIONES_GROUPS)],
    ["audit", parseList(process.env.ROLE_AUDIT_GROUPS, process.env.AZURE_AD_AUDIT_GROUPS)],
  ];

  return entries.reduce<GroupRoleMap>((acc, [role, groups]) => {
    for (const group of groups) acc[group] = role;
    return acc;
  }, {});
}

function getUserRole(email?: string | null, groups: string[] = []): Role {
  const emailLower = email?.toLowerCase() || "";
  const adminEmails = parseCsv(process.env.ADMIN_EMAILS);

  // 1. Explicit admin email list (authoritative)
  if (adminEmails.includes(emailLower)) return "admin";

  // 2. Azure AD group mapping (authoritative)
  if (groups.length > 0) return mapGroupsToRole(groups, buildEnvGroupRoleMap());

  // 3. No groups and not in admin list → least-privilege default.
  //    Previously this used substring matching on the email which was a
  //    security risk (e.g. "juan.admin@company.com" → admin).
  return "audit";
}

function getProfileEmail(profile: unknown, fallback?: string | null) {
  return getProfileEmails(profile, fallback)[0] || null;
}

function getProfileGroups(profile: unknown) {
  if (!profile || typeof profile !== "object") return [];

  const candidate = profile as Record<string, unknown>;
  const claimNames = [
    "groups",
    "roles",
    "wids",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
  ];

  return claimNames.flatMap((claimName) => {
    const claim = candidate[claimName];

    if (Array.isArray(claim)) {
      return claim.filter((group): group is string => typeof group === "string");
    }

    return typeof claim === "string" ? [claim] : [];
  });
}

function decodeJwtClaims(token?: string) {
  if (!token) return {};

  try {
    const [, payload] = token.split(".");
    if (!payload) return {};

    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

async function getAzureAdMemberGroups(accessToken?: string) {
  if (!accessToken) return [];

  try {
    const groups: string[] = [];
    let url =
      "https://graph.microsoft.com/v1.0/me/memberOf?$select=id,displayName";

    while (url) {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        console.warn("Azure AD groups lookup failed", response.status);
        return groups;
      }

      const data = (await response.json()) as {
        value?: Array<{ id?: string; displayName?: string }>;
        "@odata.nextLink"?: string;
      };

      for (const group of data.value || []) {
        if (group.displayName) groups.push(group.displayName);
        if (group.id) groups.push(group.id);
      }

      url = data["@odata.nextLink"] || "";
    }

    return groups;
  } catch (error) {
    console.warn("Azure AD groups lookup error", error);
    return [];
  }
}

function authAuditContext(method = "AUTH") {
  const context = getRequestContext();
  return {
    ...context,
    method,
    route: "/auth/callback",
  };
}

async function recordAuthAudit(input: Parameters<typeof recordAuditEvent>[0]) {
  try {
    await recordAuditEvent({
      ...input,
      category: "authentication",
      source: "server",
      confidence: "authoritative",
      context: input.context || authAuditContext(),
    });
  } catch {
    // La autenticación no se bloquea por una caída del registro de auditoría.
  }
}

async function recordCredentialFailure(code: string) {
  await recordAuthAudit({
    actorType: "anonymous",
    action: "auth.login.failure",
    authMethod: "credentials",
    result: "failure",
    statusCode: 401,
    metadata: { code },
  });
}

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID || "",
      clientSecret: resolveSecret(process.env.AZURE_AD_CLIENT_SECRET || ""),
      tenantId: process.env.AZURE_AD_TENANT_ID || "",
      authorization: {
        params: {
          scope: "openid profile email User.Read",
        },
      },
    }),
    CredentialsProvider({
      name: "Local",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const user = process.env.LOCAL_ADMIN_USER;
        const passHash = process.env.LOCAL_ADMIN_PASSWORD_HASH;
        const passPlain = process.env.LOCAL_ADMIN_PASSWORD;

        if (!user || credentials?.username !== user) {
          await recordCredentialFailure("invalid_credentials");
          return null;
        }

        // Preferido: hash irreversible scrypt (no se puede desencriptar, solo verificar).
        if (passHash && isPasswordHash(passHash)) {
          if (credentials?.password && verifyPassword(credentials.password, passHash)) {
            return {
              id: "local-admin",
              name: "Administrator",
              email: "admin@ux.local",
              role: "admin" as Role,
              permissions: getPermissions("admin"),
              groups: ["UX_INVENTORY"],
            };
          }
          await recordCredentialFailure("invalid_credentials");
          return null;
        }

        // Migración: password en texto plano (eliminar tras migrar con scripts/secrets.mjs).
        if (passPlain && credentials?.password === passPlain) {
          if (process.env.NODE_ENV !== "test") {
            console.warn("[auth] LOCAL_ADMIN_PASSWORD en texto plano: migra a LOCAL_ADMIN_PASSWORD_HASH con scrypt.");
          }
          return {
            id: "local-admin",
            name: "Administrator",
            email: "admin@ux.local",
            role: "admin" as Role,
            permissions: getPermissions("admin"),
            groups: ["UX_INVENTORY"],
          };
        }

        await recordCredentialFailure(passPlain ? "invalid_credentials" : "credentials_unavailable");
        return null;
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  secret: resolveSecret(process.env.NEXTAUTH_SECRET),
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, profile, account }) {
      // El login local ya valida usuario y password contra el hash configurado.
      if (account?.provider === "credentials") return true;

      const idTokenClaims = decodeJwtClaims(account?.id_token);
      const decision = evaluateAzureAdAccess(
        [profile, idTokenClaims],
        user.email,
      );
      let allowedByGroup = false;

      // Un grupo configurado es una via adicional de acceso, por ejemplo para
      // guests. ALLOWED_USERS, cuando tiene valores, sigue siendo estricto.
      if (
        !decision.allowed &&
        parseCsv(process.env.ALLOWED_USERS).length === 0 &&
        (process.env.AZURE_AD_ALLOWED_GROUPS || "").trim()
      ) {
        const tokenGroups = uniqueStrings([
          ...getProfileGroups(profile),
          ...getProfileGroups(idTokenClaims),
        ]);
        let groups = tokenGroups;

        if (!isInAllowedAzureAdGroup(groups)) {
          groups = uniqueStrings([
            ...tokenGroups,
            ...await getAzureAdMemberGroups(account?.access_token),
          ]);
        }

        allowedByGroup = isInAllowedAzureAdGroup(groups);
      }

      if (allowedByGroup) {
        console.info("[auth] Azure AD sign-in allowed by configured group");
        return true;
      }

      if (!decision.allowed) {
        const profileClaims = profile && typeof profile === "object"
          ? profile as Record<string, unknown>
          : undefined;
        const tenantId = typeof profileClaims?.tid === "string"
          ? profileClaims.tid
          : undefined;

        console.warn("[auth] Azure AD sign-in denied", {
          reason: decision.reason,
          identityDomains: decision.identityDomains,
          tenantId,
        });
        await recordAuthAudit({
          actorType: "anonymous",
          action: "auth.login.denied",
          authMethod: account?.provider || "azure-ad",
          result: "denied",
          statusCode: 403,
          metadata: {
            reason: decision.reason,
            identityDomains: decision.identityDomains,
            tenantId: tenantId || null,
          },
        });
      }

      return decision.allowed;
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
        const idTokenClaims = decodeJwtClaims(account.id_token);
        const graphGroups = await getAzureAdMemberGroups(account.access_token);
        const email = getProfileEmail(profile, token.email);
        const groups = uniqueStrings([
          ...getProfileGroups(profile),
          ...getProfileGroups(idTokenClaims),
          ...graphGroups,
        ]);
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
  events: {
    async signIn({ user, account, profile }) {
      const role = (user.role as Role | undefined) || getUserRole(user.email);
      const profileClaims = profile && typeof profile === "object"
        ? profile as Record<string, unknown>
        : undefined;
      await recordAuthAudit({
        actorType: "user",
        actor: {
          userId: user.id || "unknown",
          email: user.email || "unknown",
          name: user.name || "Unknown",
          role,
        },
        action: "auth.login.success",
        authMethod: account?.provider || "unknown",
        result: "success",
        statusCode: 200,
        targetType: "session",
        metadata: {
          role,
          tenantId: typeof profileClaims?.tid === "string" ? profileClaims.tid : null,
        },
        context: authAuditContext("SIGNIN"),
      });
    },
    async signOut({ session }) {
      if (!session?.user) return;
      await recordAuthAudit({
        session,
        action: "auth.logout.success",
        authMethod: "session",
        result: "success",
        statusCode: 200,
        targetType: "session",
        context: authAuditContext("SIGNOUT"),
      });
    },
  },
};

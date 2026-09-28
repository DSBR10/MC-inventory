type AzureAdAccessDecision = {
  allowed: boolean;
  reason:
    | "allowed"
    | "missing_identity"
    | "user_not_allowlisted"
    | "domain_not_allowed"
    | "access_policy_not_configured";
  identityDomains: string[];
};

const AZURE_IDENTITY_CLAIMS = [
  "email",
  "preferred_username",
  "upn",
  "unique_name",
] as const;

function parseCsv(value?: string) {
  return (value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function getProfileEmails(profile: unknown, fallback?: string | null) {
  const candidates = Array.isArray(profile) ? profile : [profile];
  const identities = [
    ...candidates.flatMap((candidate) => {
      const claims = candidate && typeof candidate === "object"
        ? candidate as Record<string, unknown>
        : {};
      return AZURE_IDENTITY_CLAIMS.map((claim) => claims[claim]);
    }),
    fallback,
  ];

  return [...new Set(
    identities
      .filter((identity): identity is string => typeof identity === "string")
      .map((identity) => identity.trim().toLowerCase())
      .filter(Boolean),
  )];
}

function getIdentityDomain(identity: string) {
  const separator = identity.indexOf("@");
  if (
    separator <= 0 ||
    separator !== identity.lastIndexOf("@") ||
    separator === identity.length - 1 ||
    /\s/.test(identity)
  ) {
    return null;
  }

  return identity.slice(separator + 1);
}

export function isInAllowedAzureAdGroup(
  groups: string[],
  env: NodeJS.ProcessEnv = process.env,
) {
  const allowedGroups = new Set(parseCsv(env.AZURE_AD_ALLOWED_GROUPS));
  if (allowedGroups.size === 0) return false;

  const memberships = new Set(
    groups
      .filter((group): group is string => typeof group === "string")
      .map((group) => group.trim().toLowerCase())
      .filter(Boolean),
  );

  return [...allowedGroups].some((group) => memberships.has(group));
}

export function evaluateAzureAdAccess(
  profile: unknown,
  fallback?: string | null,
  env: NodeJS.ProcessEnv = process.env,
): AzureAdAccessDecision {
  const identities = getProfileEmails(profile, fallback);
  const identityDomains = [...new Set(
    identities
      .map(getIdentityDomain)
      .filter((domain): domain is string => Boolean(domain)),
  )];

  if (identities.length === 0) {
    return { allowed: false, reason: "missing_identity", identityDomains };
  }

  const allowedUsers = parseCsv(env.ALLOWED_USERS);
  if (allowedUsers.length > 0) {
    const allowed = identities.some((identity) => allowedUsers.includes(identity));
    return {
      allowed,
      reason: allowed ? "allowed" : "user_not_allowlisted",
      identityDomains,
    };
  }

  // Conserva AZURE_AD_ALLOWED_DOMAIN por compatibilidad y admite una lista
  // separada por comas para tenants con varios dominios o alias corporativos.
  const allowedDomains = [env.AZURE_AD_ALLOWED_DOMAIN, env.AZURE_AD_ALLOWED_DOMAINS]
    .flatMap((value) => parseCsv(value))
    .map((domain) => domain.replace(/^@/, ""))
    .filter(Boolean);

  if (allowedDomains.length === 0) {
    const allowed = env.NODE_ENV !== "production";
    return {
      allowed,
      reason: allowed ? "allowed" : "access_policy_not_configured",
      identityDomains,
    };
  }

  const allowed = identityDomains.some((domain) => allowedDomains.includes(domain));
  return {
    allowed,
    reason: allowed ? "allowed" : "domain_not_allowed",
    identityDomains,
  };
}

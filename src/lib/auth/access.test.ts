import assert from "node:assert/strict";
import test from "node:test";

import { evaluateAzureAdAccess, getProfileEmails, isInAllowedAzureAdGroup } from "./access";

const productionDomainPolicy: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  AZURE_AD_ALLOWED_DOMAIN: "ux.local",
};

test("acepta el UPN aunque email sea un alias de otro dominio", () => {
  const decision = evaluateAzureAdAccess(
    {
      email: "alias@partner.example",
      preferred_username: "employee@ux.local",
    },
    undefined,
    productionDomainPolicy,
  );

  assert.equal(decision.allowed, true);
  assert.equal(decision.reason, "allowed");
  assert.deepEqual(decision.identityDomains, ["partner.example", "ux.local"]);
});

test("considera los claims de identidad del id token", () => {
  const decision = evaluateAzureAdAccess(
    [{}, { upn: "employee@ux.local" }],
    undefined,
    productionDomainPolicy,
  );

  assert.equal(decision.allowed, true);
});

test("usa la identidad normalizada proporcionada por NextAuth como respaldo", () => {
  const decision = evaluateAzureAdAccess(
    { email: "Alias@Partner.Example" },
    " EMPLOYEE@UX.LOCAL ",
    productionDomainPolicy,
  );

  assert.equal(decision.allowed, true);
  assert.deepEqual(getProfileEmails({ preferred_username: "person@ux.local" }), [
    "person@ux.local",
  ]);
});

test("admite varios dominios configurados", () => {
  const decision = evaluateAzureAdAccess(
    { preferred_username: "employee@ux.com" },
    undefined,
    {
      NODE_ENV: "production",
      AZURE_AD_ALLOWED_DOMAINS: "@ux.local, ux.com",
    },
  );

  assert.equal(decision.allowed, true);
});

test("rechaza una identidad fuera de la politica", () => {
  const decision = evaluateAzureAdAccess(
    { preferred_username: "employee@external.example" },
    undefined,
    productionDomainPolicy,
  );

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "domain_not_allowed");
});

test("ALLOWED_USERS tiene prioridad y compara cualquier claim de identidad", () => {
  const decision = evaluateAzureAdAccess(
    { email: "alias@partner.example", upn: "employee@ux.local" },
    undefined,
    {
      ...productionDomainPolicy,
      ALLOWED_USERS: "employee@ux.local, other@ux.local",
    },
  );

  assert.equal(decision.allowed, true);
  assert.equal(decision.reason, "allowed");
});

test("exige una identidad valida incluso en desarrollo", () => {
  const decision = evaluateAzureAdAccess({}, undefined, { NODE_ENV: "development" });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "missing_identity");
});

test("mantiene el acceso cerrado si no hay politica en produccion", () => {
  const decision = evaluateAzureAdAccess(
    { preferred_username: "employee@ux.local" },
    undefined,
    { NODE_ENV: "production" },
  );

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "access_policy_not_configured");
});

test("reconoce grupos permitidos por nombre o ID sin distinguir mayusculas", () => {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    AZURE_AD_ALLOWED_GROUPS: "UX_INVENTORY_AUDIT, 30ee1f74-fac4-4fbe-8667-71f0762040b3",
  };

  assert.equal(
    isInAllowedAzureAdGroup(["ux_inventory_audit", "Another group"], env),
    true,
  );
  assert.equal(
    isInAllowedAzureAdGroup(["30EE1F74-FAC4-4FBE-8667-71F0762040B3"], env),
    true,
  );
  assert.equal(isInAllowedAzureAdGroup(["Unrelated"], env), false);
});

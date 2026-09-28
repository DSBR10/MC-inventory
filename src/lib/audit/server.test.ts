import assert from "node:assert/strict";
import test from "node:test";

import { redactSensitiveText, sanitizeAuditMetadata } from "./server";

test("elimina credenciales y conserva metadatos operativos seguros", () => {
  const metadata = sanitizeAuditMetadata({
    password: "do-not-store",
    command: "rm -rf /",
    commandLength: 9,
    commandHash: "hmac-value",
    module: "commands",
    targetCount: 2,
  });

  assert.equal("password" in metadata, false);
  assert.equal("command" in metadata, false);
  assert.equal(metadata.commandLength, 9);
  assert.equal(metadata.commandHash, "hmac-value");
  assert.equal(metadata.module, "commands");
  assert.equal(metadata.targetCount, 2);
});

test("redacta secretos comunes en texto libre", () => {
  const redacted = redactSensitiveText(
    "curl -H 'Authorization: Bearer abc.def.ghi' https://example.test PASSWORD=super-secret"
  );

  assert.equal(redacted.includes("abc.def.ghi"), false);
  assert.equal(redacted.includes("super-secret"), false);
  assert.equal(redacted.includes("[REDACTED]"), true);
});

test("trunca metadata y conserva una estructura JSON válida", () => {
  const metadata = sanitizeAuditMetadata({
    oversized: "x".repeat(2_000),
    nested: { safe: true },
  });

  assert.equal(typeof metadata, "object");
  assert.equal(JSON.parse(JSON.stringify(metadata)).nested.safe, true);
});

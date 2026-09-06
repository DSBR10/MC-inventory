import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

// ─────────────────────────────────────────────
// Cifrado operativo (reversible, necesario para usar las keys):
//   AES-256-GCM (AEAD, estándar actual / NIST). Mejor opción simétrica
//   para secretos que la app DEBE leer (AK/SK de AWS/Huawei, tokens).
//
// Passwords (nunca se deben poder recuperar):
//   scrypt con N=16384, r=8, p=1 (OWASP). Irreversible, solo verificable.
//   Es lo mejor disponible nativo en Node sin dependencias nativas
//   (la alternativastate-of-the-art es Argon2id, requiere lib externa).
//
// "Encriptado sin posibilidad de desencriptar" solo existe como HASH,
// y un hash de una AK/SK vuelve la key INUTILIZABLE (la app ya no
// podría firmar peticiones a AWS/Huawei). Por eso se separan ambos casos.
// ─────────────────────────────────────────────

const ENC_PREFIX = "ENC:v1:";

// Carga perezosa de .env.master.key (solo desarrollo local).
// En producción la master key debe venir del entorno / secret manager.
let masterKeyFileAttempted = false;

function tryLoadMasterKeyFile(): void {
  if (masterKeyFileAttempted) return;
  masterKeyFileAttempted = true;
  if (process.env.CREDENTIALS_MASTER_KEY?.trim()) return;
  try {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const candidates = [
      path.join(process.cwd(), ".env.master.key"),
      path.join(process.cwd(), "..", ".env.master.key"),
    ];
    for (const file of candidates) {
      try {
        const content = fs.readFileSync(file, "utf8");
        const match = content.match(/^\s*CREDENTIALS_MASTER_KEY\s*=\s*(.+?)\s*$/m);
        if (match && match[1] && !(process.env.CREDENTIALS_MASTER_KEY || "").trim()) {
          process.env.CREDENTIALS_MASTER_KEY = match[1].trim();
          return;
        }
      } catch {
        // probar siguiente candidato
      }
    }
  } catch {
    // entorno sin fs (edge): se ignora, se exigirá la variable de entorno
  }
}

function getMasterKey(): Buffer {
  tryLoadMasterKeyFile();
  const raw = process.env.CREDENTIALS_MASTER_KEY?.trim();
  if (!raw) {
    throw new Error(
      "CREDENTIALS_MASTER_KEY no configurada. Genera una con: node scripts/secrets.mjs generate-key",
    );
  }
  // Se acepta base64 de 32 bytes (44 chars) o hex de 64 chars.
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    key = Buffer.from(raw, "base64");
  }
  if (key.length !== 32) {
    throw new Error("CREDENTIALS_MASTER_KEY inválida: debe ser de 256 bits (32 bytes en base64 o hex).");
  }
  return key;
}

export function isEncryptedValue(value: string | undefined): boolean {
  return !!value && value.startsWith(ENC_PREFIX);
}

/** Cifra un secreto en memoria. Solo llamar con la key ya cargada en env. */
export function encryptSecret(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(12); // 96 bits, recomendado para GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

/** Descifra un valor ENC:v1:... Lanza si la master key es incorrecta o el dato fue manipulado. */
export function decryptSecret(encrypted: string): string {
  const key = getMasterKey();
  const parts = encrypted.split(":");
  // ["ENC", "v1", iv, tag, ct]
  if (parts.length !== 5 || parts[0] !== "ENC" || parts[1] !== "v1") {
    throw new Error("Formato cifrado inválido.");
  }
  const iv = Buffer.from(parts[2], "base64");
  const tag = Buffer.from(parts[3], "base64");
  const ciphertext = Buffer.from(parts[4], "base64");
  if (iv.length !== 12 || tag.length !== 16) {
    throw new Error("Formato cifrado inválido.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/**
 * Resuelve un secreto que puede venir en texto plano (migración) o
 * cifrado (ENC:v1:...). En producción el plaintext debería desaparecer;
 * si `strict` es true, rechaza el plaintext.
 */
export function resolveSecret(value: string | undefined, opts?: { strict?: boolean; label?: string }): string {
  const v = value?.trim() ?? "";
  if (!v) return "";
  if (isEncryptedValue(v)) return decryptSecret(v);
  if (opts?.strict) {
    throw new Error(`Secreto ${opts.label ?? ""} en texto plano rechazado (modo estricto). Cífralo con scripts/secrets.mjs.`.trim());
  }
  return v;
}

/** ¿Hay algún secreto operativo todavía en texto plano? Útil para health checks. */
export function hasPlaintextSecrets(values: Array<string | undefined>): boolean {
  return values.some((v) => {
    const t = v?.trim() ?? "";
    return t.length > 0 && !isEncryptedValue(t) && !/^REPLACE_WITH_/i.test(t) && t !== "true" && t !== "false";
  });
}

// ─────────────────────────────────────────────
// Passwords: hash IRREVERSIBLE con scrypt (no se puede desencriptar)
// Formato: scrypt$16384$8$1$<salt_b64>$<hash_b64>
// ─────────────────────────────────────────────

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 32;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    // Tolerancia compose: en archivos .env el `$` se escapa como `$$`
    // (compose interpola `$VAR`). dotenv de Next.js NO desescapa, así que
    // se normaliza aquí. En el contenedor compose ya desescapó: no-op.
    const normalized = stored.replace(/\$\$/g, "$");
    const parts = normalized.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    const salt = Buffer.from(parts[4], "base64");
    const expected = Buffer.from(parts[5], "base64");
    if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
    if (salt.length < 8 || expected.length !== SCRYPT_KEYLEN) return false;
    const actual = scryptSync(password, salt, expected.length, { N, r, p });
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function isPasswordHash(value: string | undefined): boolean {
  return !!value && value.replace(/\$\$/g, "$").startsWith("scrypt$");
}

// ─────────────────────────────────────────────
// Fingerprint para logs/auditoría: HMAC-SHA256 irreversible,
// muestra solo prefijo para identificar la key sin exponerla.
// ─────────────────────────────────────────────

export function fingerprintSecret(value: string): string {
  let auditSecret = "";
  try {
    auditSecret = resolveSecret(process.env.AUDIT_HASH_SECRET?.trim());
  } catch {
    auditSecret = "";
  }
  const key = auditSecret && auditSecret.length >= 32 ? auditSecret : "mc-inventory-local-fingerprint";
  const full = createHmac("sha256", key).update(value, "utf8").digest("hex");
  return `${full.slice(0, 8)}…${full.slice(-4)}`;
}

/** Últimos 4 caracteres para correlación humana (ej. "...AF44"). Nunca loguear más. */
export function last4(value: string): string {
  const t = value.trim();
  return t.length <= 4 ? "****" : `…${t.slice(-4)}`;
}

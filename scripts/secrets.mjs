// CLI de secretos — sin dependencias externas.
// Uso:
//   node scripts/secrets.mjs generate-key
//   node scripts/secrets.mjs encrypt "<valor>"                 (requiere CREDENTIALS_MASTER_KEY en env)
//   node scripts/secrets.mjs decrypt "<ENC:v1:...>"            (requiere CREDENTIALS_MASTER_KEY en env)
//   node scripts/secrets.mjs hash-password "<password>"
//   node scripts/secrets.mjs migrate-env [--write]             (cifra .env y .env.local en su lugar)
//
// migrate-env: genera master key si no existe (la guarda en .env.master.key, gitignored),
// cifra AK/SK/secrets en texto plano y hashea LOCAL_ADMIN_PASSWORD con scrypt.
// IMPORTANTE: tras migrar, ROTA las keys en AWS/Huawei porque ya estuvieron en texto plano.
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ENC_PREFIX = "ENC:v1:";

function loadDotenvFiles() {
  for (const f of [".env.master.key", ".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    try {
      const content = readFileSync(f, "utf8");
      for (const line of content.split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("=");
        if (eq === -1) continue;
        const k = t.slice(0, eq).trim();
        let v = t.slice(eq + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (!(k in process.env)) process.env[k] = v;
      }
    } catch { /* noop */ }
  }
}

function getKey() {
  const raw = (process.env.CREDENTIALS_MASTER_KEY || "").trim();
  if (!raw) throw new Error("Falta CREDENTIALS_MASTER_KEY en el entorno.");
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("CREDENTIALS_MASTER_KEY inválida (debe ser 256 bits).");
  return key;
}

function enc(plain) {
  const key = getKey();
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `${ENC_PREFIX}${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${ct.toString("base64")}`;
}

function dec(v) {
  const key = getKey();
  const p = v.split(":");
  if (p.length !== 5) throw new Error("Formato inválido.");
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(p[2], "base64"));
  d.setAuthTag(Buffer.from(p[3], "base64"));
  return Buffer.concat([d.update(Buffer.from(p[4], "base64")), d.final()]).toString("utf8");
}

function hashPw(pw) {
  const salt = randomBytes(16);
  const h = scryptSync(pw, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("base64")}$${h.toString("base64")}`;
}

// Claves que deben cifrarse si están en texto plano.
// NOTA: POSTGRES_PASSWORD / DATABASE_URL se soportan como ENC en código
// (resolveSecret), pero NO se migran automáticamente porque el servicio
// `postgres` de docker-compose necesita el password en texto plano para
// bootstrapping. En producción inyéctalo desde un secret manager.
const ENCRYPT_KEYS = [
  "NEXTAUTH_SECRET",
  "AUDIT_HASH_SECRET",
  "AZURE_AD_CLIENT_SECRET",
  "AWS_ACCOUNT_1_ACCESS_KEY",
  "AWS_ACCOUNT_1_ACCESS_KEY_ID",
  "AWS_ACCOUNT_1_SECRET_KEY",
  "AWS_ACCOUNT_1_SECRET_ACCESS_KEY",
  "AWS_ACCOUNT_2_ACCESS_KEY",
  "AWS_ACCOUNT_2_ACCESS_KEY_ID",
  "AWS_ACCOUNT_2_SECRET_KEY",
  "AWS_ACCOUNT_2_SECRET_ACCESS_KEY",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "HUAWEI_ACCOUNT_1_AK",
  "HUAWEI_ACCOUNT_1_SK",
  "HUAWEI_ACCOUNT_2_AK",
  "HUAWEI_ACCOUNT_2_SK",
  "HUAWEI_ACCOUNT_3_AK",
  "HUAWEI_ACCOUNT_3_SK",
];

function isPlaceholder(v) {
  return !v || /^REPLACE_WITH_/i.test(v) || v === "replace-with-a-long-random-value";
}

function processEnvContent(content) {
  let masterKey = (process.env.CREDENTIALS_MASTER_KEY || "").trim();
  let generatedKey = "";
  if (!masterKey) {
    generatedKey = randomBytes(32).toString("base64");
    process.env.CREDENTIALS_MASTER_KEY = generatedKey;
    masterKey = generatedKey;
  }
  const lines = content.split("\n");
  let changed = 0;
  const out = lines.map((line) => {
    const m = line.match(/^(\s*)([A-Z0-9_]+)(\s*=\s*)(.*?)(\s*(?:#.*)?)$/);
    if (!m) return line;
    const [, pre, key, eq, rawVal] = m;
    let val = rawVal.trim();
    const quoted = (val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"));
    if (quoted) val = val.slice(1, -1);

    // 1) Password local -> hash scrypt irreversible
    if (key === "LOCAL_ADMIN_PASSWORD" && val && !val.startsWith("scrypt$") && !isPlaceholder(val)) {
      const h = hashPw(val);
      changed++;
      // Se reemplaza por el hash en una variable nueva y se elimina el plaintext.
      // El loader soporta LOCAL_ADMIN_PASSWORD_HASH con prioridad.
      // Se escapa `$` como `$$` porque docker compose interpola `$VAR` en .env;
      // el parser (verifyPassword) acepta ambas formas.
      return `${pre}LOCAL_ADMIN_PASSWORD_HASH${eq}${h.replace(/\$/g, "$$")}`;
    }
    if (key === "LOCAL_ADMIN_PASSWORD_HASH") return line; // ya migrado

    // 2) Secretos operativos -> AES-256-GCM
    // (POSTGRES_PASSWORD y DATABASE_URL se excluyen: los necesita el
    //  contenedor postgres en texto plano para bootstrapping.)
    if (key === "POSTGRES_PASSWORD" || key === "DATABASE_URL") return line;
    if (ENCRYPT_KEYS.includes(key) || /_SECRET|_PASSWORD|_PRIVATE_KEY/.test(key)) {
      if (!val || val.startsWith(ENC_PREFIX) || isPlaceholder(val) || val === "disable") return line;
      // DATABASE_URL contiene password embebida: se cifra completa.
      const e = enc(val);
      changed++;
      return `${pre}${key}${eq}${e}`;
    }
    return line;
  });
  return { content: out.join("\n"), changed, generatedKey };
}

const [cmd, arg] = process.argv.slice(2);

if (cmd === "generate-key") {
  console.log(randomBytes(32).toString("base64"));
} else if (cmd === "encrypt") {
  loadDotenvFiles();
  if (!arg) { console.error('Uso: node scripts/secrets.mjs encrypt "<valor>"'); process.exit(1); }
  console.log(enc(arg));
} else if (cmd === "decrypt") {
  loadDotenvFiles();
  if (!arg) { console.error('Uso: node scripts/secrets.mjs decrypt "<ENC:v1:...>"'); process.exit(1); }
  console.log(dec(arg));
} else if (cmd === "hash-password") {
  if (!arg) { console.error('Uso: node scripts/secrets.mjs hash-password "<password>"'); process.exit(1); }
  console.log(hashPw(arg));
} else if (cmd === "migrate-env") {
  loadDotenvFiles();
  const write = process.argv.includes("--write");
  let masterKey = (process.env.CREDENTIALS_MASTER_KEY || "").trim();
  let newKey = "";
  if (!masterKey) {
    newKey = randomBytes(32).toString("base64");
    process.env.CREDENTIALS_MASTER_KEY = newKey;
    masterKey = newKey;
  }
  for (const f of [".env", ".env.local"]) {
    if (!existsSync(f)) { console.log(`(omitido) ${f} no existe`); continue; }
    const original = readFileSync(f, "utf8");
    const { content, changed } = processEnvContent(original);
    if (write && changed > 0) {
      writeFileSync(f, content, "utf8");
      console.log(`${f}: ${changed} secreto(s) migrados a cifrado/hash.`);
    } else {
      console.log(`${f}: ${changed} secreto(s) por migrar.${write ? "" : " (dry-run, usa --write para aplicar)"}`);
    }
  }
  // La master key NUNCA se escribe dentro de .env: va a archivo separado gitignored.
  if (newKey && write) {
    if (!existsSync(".env.master.key")) {
      writeFileSync(".env.master.key", `CREDENTIALS_MASTER_KEY=${newKey}\n`, { mode: 0o600 });
      console.log("Master key generada en .env.master.key (gitignored, permiso 600). RESPÁLDALA en tu gestor de secretos y NO la commitees.");
    } else {
      console.log("Ya existe .env.master.key; la nueva key generada NO se guardó automáticamente. Guárdala manualmente:");
      console.log(newKey);
    }
  } else if (newKey && !write) {
    console.log("(dry-run) master key que se usaría (no guardada):");
    console.log(newKey);
  }
  console.log("\nAVISO: las AK/SK anteriores estuvieron en texto plano. RÓTALAS en AWS/Huawei después de migrar.");
} else {
  console.error("Comandos: generate-key | encrypt | decrypt | hash-password | migrate-env [--write]");
  process.exit(1);
}

import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/server";
import {
  SSMClient,
  SendCommandCommand,
  GetCommandInvocationCommand,
} from "@aws-sdk/client-ssm";

const region = process.env.AWS_REGION || "us-east-1";

/* ===============================
   BLOCKLIST DE COMANDOS PELIGROSOS
   =============================== */

const DANGEROUS_PATTERNS: RegExp[] = [
  // Borrado masivo
  /rm\s+(-[a-zA-Z]*f[a-zA-Z]*|-[a-zA-Z]*r[a-zA-Z]*|-rf|-fr)\s+[\/\*~]/i,
  /rm\s+.*\*+/i,
  /rm\s+-rf/i,

  // Formateo y particiones
  /mkfs/i,
  /fdisk/i,
  /parted/i,
  /dd\s+.*of=\/dev\//i,

  // Apagado y reinicio
  /\breboot\b/i,
  /\bshutdown\b/i,
  /\bhalt\b/i,
  /\bpoweroff\b/i,
  /\binit\s+[06]\b/i,
  /systemctl\s+(reboot|poweroff|halt|shutdown)/i,

  // Escalada de privilegios peligrosa
  /\bchmod\s+(-R\s+)?[0-7]*7[0-7]*\s+\/\b/i,   // chmod en raíz
  /\bchown\s+.*\/$/i,                             // chown en raíz
  /\bsudo\s+su\b/i,
  /\bsudo\s+-i\b/i,

  // Truncar o sobreescribir archivos críticos
  />\s*\/etc\/(passwd|shadow|sudoers|hosts|fstab|crontab)/i,
  />\s*\/dev\/(sda|hda|vda|xvda|nvme)/i,

  // Eliminar directorios del sistema
  /rm\s+.*\/(etc|bin|sbin|lib|lib64|usr|boot|sys|proc|dev|root)\b/i,

  // Fork bomb
  /:\(\)\s*\{.*\}/i,
  /\(\)\s*\{\s*:\|:&\s*\}/i,

  // Pipes destructivas
  /curl.*\|\s*(ba)?sh/i,
  /wget.*\|\s*(ba)?sh/i,
  /\|\s*bash\s*$/i,
  /\|\s*sh\s*$/i,

  // Manipulación de servicios críticos del sistema
  /systemctl\s+(stop|disable|mask)\s+(sshd|ssh|network|NetworkManager|firewalld|iptables|auditd|ssm-agent|amazon-ssm-agent)/i,
  /service\s+(sshd|ssh|network|ssm-agent)\s+(stop|disable)/i,

  // Borrar logs de auditoría
  />\s*\/var\/log\/(audit|secure|messages|wtmp|btmp)/i,
  /rm\s+.*\/var\/log\//i,

  // Manipulación de firewall masiva
  /iptables\s+-F/i,           // flush todas las reglas
  /iptables\s+-X/i,
  /nft\s+flush/i,

  // Historial
  /history\s+-[cw]/i,
  />\s*~\/\.bash_history/i,
  /unset\s+HISTFILE/i,

  // Exploits comunes
  /base64\s+.*\|\s*(ba)?sh/i,
  /python.*-c.*exec/i,
  /perl.*-e.*system/i,
  /php.*-r.*system/i,
];

/* ===============================
   WHITELIST DE COMANDOS SEGUROS
   (opcional — activar si se quiere
   modo restrictivo total)
   =============================== */

const SAFE_COMMANDS_WHITELIST: RegExp[] = [
  /^(ls|pwd|whoami|hostname|uptime|df|du|free|top|ps|cat|tail|head|grep|find|echo|date|uname|id|env|printenv|netstat|ss|curl\s+https?:\/\/|ping|traceroute|dig|nslookup|systemctl\s+status|journalctl|aws\s+s3|aws\s+ec2)/i,
];

/* ===============================
   VALIDADOR PRINCIPAL
   =============================== */

interface ValidationResult {
  blocked: boolean;
  reason?: string;
}

function validateCommand(command: string): ValidationResult {
  const trimmed = command.trim();

  // Rechazar comandos vacíos
  if (!trimmed) {
    return { blocked: true, reason: "Empty command" };
  }

  // Rechazar comandos muy largos (posible ofuscación)
  if (trimmed.length > 1000) {
    return { blocked: true, reason: "Command exceeds maximum length" };
  }

  // Detectar ofuscación con base64
  if (/echo\s+[A-Za-z0-9+/]{20,}={0,2}\s*\|\s*(base64|ba64)/.test(trimmed)) {
    return { blocked: true, reason: "Possible base64 obfuscation detected" };
  }

  // Detectar concatenación sospechosa de comandos destructivos
  const chainedCommands = trimmed.split(/[;&|]+/);
  for (const part of chainedCommands) {
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(part.trim())) {
        return {
          blocked: true,
          reason: `Dangerous pattern detected: "${part.trim().slice(0, 60)}"`,
        };
      }
    }
  }

  return { blocked: false };
}

/* ===============================
   GET ALL ACCOUNTS DYNAMICALLY
   =============================== */

function getAllAccounts(): { id: string; accessKey: string; secretKey: string }[] {
  const accounts: { id: string; accessKey: string; secretKey: string }[] = [];
  const env = process.env;

  Object.keys(env).forEach((key) => {
    const match = key.match(/^AWS_ACCOUNT_(\d+)_ID$/);
    if (match) {
      const index = match[1];
      const id = env[`AWS_ACCOUNT_${index}_ID`];
      const accessKey =
        env[`AWS_ACCOUNT_${index}_ACCESS_KEY`] ||
        env[`AWS_ACCOUNT_${index}_ACCESS_KEY_ID`];
      const secretKey =
        env[`AWS_ACCOUNT_${index}_SECRET_KEY`] ||
        env[`AWS_ACCOUNT_${index}_SECRET_ACCESS_KEY`];
      if (id && accessKey && secretKey) {
        accounts.push({ id, accessKey, secretKey });
      }
    }
  });

  return accounts;
}

/* ===============================
   GET CREDS PER ACCOUNT
   =============================== */

function getCredentials(accountId: string) {
  const accounts = getAllAccounts();
  const acc = accounts.find((a) => a.id === accountId);
  if (!acc) {
    throw new Error(`Account not configured: ${accountId}`);
  }
  return {
    accessKeyId: acc.accessKey,
    secretAccessKey: acc.secretKey,
  };
}

/* ===============================
   WAIT FOR COMMAND (POLLING)
   =============================== */

async function waitForCommand(
  ssm: SSMClient,
  commandId: string,
  instanceId: string
) {
  const maxAttempts = 15;
  const delay = 2000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, delay));
    try {
      const res = await ssm.send(
        new GetCommandInvocationCommand({
          CommandId: commandId,
          InstanceId: instanceId,
        })
      );

      const status = res.Status;
      if (
        status === "Success" ||
        status === "Failed" ||
        status === "Cancelled" ||
        status === "TimedOut"
      ) {
        return res;
      }
    } catch {
      continue;
    }
  }

  throw new Error("Timeout waiting for command result");
}

/* ===============================
   LOGGER DE AUDITORÍA
   =============================== */

function auditLog(entry: {
  timestamp: string;
  command: string;
  instances: any[];
  blocked: boolean;
  reason?: string;
  ip?: string;
}) {
  // Aquí puedes enviar a CloudWatch, una DB, o simplemente loguear
  console.log("[AUDIT]", JSON.stringify(entry));
}

/* ===============================
   API
   =============================== */

export async function POST(req: NextRequest) {
  try {
    const guard = await requireApiSession("inventory:modify");
    if (guard.response) return guard.response;

    const { instances, command } = await req.json();
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const timestamp = new Date().toISOString();

    // Validación básica
    if (!instances?.length || !command) {
      return NextResponse.json(
        { error: "Missing instances or command" },
        { status: 400 }
      );
    }

    // ── Validación de seguridad ──
    const validation = validateCommand(command);

    auditLog({
      timestamp,
      command,
      instances,
      blocked: validation.blocked,
      reason: validation.reason,
      ip,
    });

    if (validation.blocked) {
      console.warn(`[SECURITY] Blocked command from ${ip}: "${command}" — ${validation.reason}`);
      return NextResponse.json(
        {
          error: "Command blocked for security reasons",
          reason: validation.reason,
        },
        { status: 403 }
      );
    }

    // ── Ejecución ──
    const results: any[] = [];

    for (const instance of instances) {
      try {
        const creds = getCredentials(instance.accountId);
        const ssm = new SSMClient({ region, credentials: creds });

        const send = await ssm.send(
          new SendCommandCommand({
            InstanceIds: [instance.instanceId],
            DocumentName: "AWS-RunShellScript",
            Parameters: { commands: [command] },
          })
        );

        const commandId = send.Command?.CommandId;
        if (!commandId) throw new Error("No commandId returned");

        const result = await waitForCommand(ssm, commandId, instance.instanceId);

        results.push({
          instanceId: instance.instanceId,
          accountId: instance.accountId,
          output: result.StandardOutputContent || "",
          error: result.StandardErrorContent || "",
        });
      } catch (err: any) {
        console.error(`Error on ${instance.instanceId}:`, err.message);
        results.push({
          instanceId: instance.instanceId,
          accountId: instance.accountId,
          error: "❌ No SSM connection or instance unreachable",
        });
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Global error:", error);
    return NextResponse.json(
      { error: "Command execution failed" },
      { status: 500 }
    );
  }
}

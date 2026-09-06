import { NextRequest, NextResponse } from "next/server";
import {
  GetCommandInvocationCommand,
  SendCommandCommand,
  SSMClient,
} from "@aws-sdk/client-ssm";

import { requireApiSession } from "@/lib/auth/server";
import { resolveSecret } from "@/lib/secrets/crypto";
import {
  getRequestContext,
  hasAuditHashSecret,
  hashAuditValue,
  recordAuditEvent,
  redactCommandPreview,
  redactSensitiveText,
} from "@/lib/audit/server";

type OsType = "linux" | "windows";
type ExecutionStatus = "success" | "failed" | "timedOut" | "cancelled" | "error";

type CommandTarget = {
  instanceId: string;
  accountId: string;
  accountName?: string;
  name?: string;
  osType?: OsType;
};

type CommandResult = {
  instanceId: string;
  accountId: string;
  accountName?: string;
  name?: string;
  status: ExecutionStatus;
  commandId?: string;
  output?: string;
  error?: string;
  durationMs?: number;
};

type ValidationResult = {
  blocked: boolean;
  reason?: string;
};

const region = process.env.AWS_REGION || "us-east-1";
const maxTargets = Math.min(Math.max(Number(process.env.COMMAND_MAX_TARGETS || 50) || 50, 1), 100);
const maxCommandLength = Math.min(Math.max(Number(process.env.COMMAND_MAX_LENGTH || 4000) || 4000, 1), 16_000);

const sharedDangerousPatterns: Array<[RegExp, string]> = [
  [/\b(reboot|shutdown|halt|poweroff)\b/i, "Apagado o reinicio del sistema"],
  [/\b(init\s+[06])\b/i, "Cambio de runlevel para apagar o reiniciar"],
  [/\bmkfs\b|\bfdisk\b|\bparted\b|\bdd\s+.*of=\/dev\//i, "Formateo o manipulación de discos"],
  [/curl\b.*\|\s*(ba)?sh\b|wget\b.*\|\s*(ba)?sh\b/i, "Ejecución remota por pipe"],
  [/\|\s*(bash|sh|powershell|pwsh)\s*$/i, "Pipe directo a intérprete"],
  [/base64\s+.*\|\s*(ba)?sh|encodedcommand|frombase64string/i, "Ofuscación con base64"],
  [/\bpython\b.*-c.*exec|\bperl\b.*-e.*system|\bphp\b.*-r.*system/i, "Ejecución dinámica ofuscada"],
];

const linuxDangerousPatterns: Array<[RegExp, string]> = [
  [/\brm\s+(-[a-zA-Z]*f[a-zA-Z]*|-[a-zA-Z]*r[a-zA-Z]*|-rf|-fr)\b/i, "Borrado recursivo o forzado"],
  [/\brm\b.*(\*|\/etc|\/bin|\/sbin|\/lib|\/lib64|\/usr|\/boot|\/sys|\/proc|\/dev|\/root)\b/i, "Borrado de rutas críticas"],
  [/\bchmod\s+(-R\s+)?[0-7]*7[0-7]*\s+\/\b/i, "Cambio peligroso de permisos en raíz"],
  [/\bchown\s+.*\/$/i, "Cambio peligroso de ownership en raíz"],
  [/\bsudo\s+(su|-i)\b/i, "Escalada interactiva de privilegios"],
  [/>+\s*\/etc\/(passwd|shadow|sudoers|hosts|fstab|crontab)/i, "Sobrescritura de archivos críticos"],
  [/>+\s*\/dev\/(sda|hda|vda|xvda|nvme)/i, "Sobrescritura directa de disco"],
  [/:\(\)\s*\{.*\}|\(\)\s*\{\s*:\|:&\s*\}/i, "Fork bomb"],
  [/systemctl\s+(reboot|poweroff|halt|shutdown|stop|disable|mask)\s+(sshd|ssh|network|NetworkManager|firewalld|iptables|auditd|ssm-agent|amazon-ssm-agent)?/i, "Manipulación de servicios críticos"],
  [/service\s+(sshd|ssh|network|ssm-agent)\s+(stop|disable)/i, "Manipulación de servicios críticos"],
  [/>+\s*\/var\/log\/(audit|secure|messages|wtmp|btmp)|\brm\b.*\/var\/log\//i, "Borrado o truncado de logs"],
  [/\biptables\s+(-F|-X)\b|\bnft\s+flush\b/i, "Flush de firewall"],
  [/\bhistory\s+-[cw]\b|>+\s*~\/\.bash_history|\bunset\s+HISTFILE\b/i, "Borrado de historial"],
];

const windowsDangerousPatterns: Array<[RegExp, string]> = [
  [/\bRestart-Computer\b|\bStop-Computer\b|\bshutdown(\.exe)?\b/i, "Apagado o reinicio del sistema"],
  [/\bRemove-Item\b.*(-Recurse|-Force)|\brd\s+\/s\b|\bdel\s+\/[fsq]/i, "Borrado recursivo o forzado"],
  [/\bFormat-Volume\b|\bClear-Disk\b|\bInitialize-Disk\b|\bdiskpart\b/i, "Formateo o manipulación de discos"],
  [/\bSet-ExecutionPolicy\b|\bDisable-PSRemoting\b/i, "Cambio sensible de PowerShell"],
  [/\bRemove-LocalUser\b|\bDisable-LocalUser\b|\bnet\s+user\b.*\/delete/i, "Eliminación o deshabilitación de usuarios"],
  [/\bClear-EventLog\b|\bwevtutil\s+cl\b/i, "Borrado de eventos de auditoría"],
  [/\bNew-NetFirewallRule\b|\bSet-NetFirewallProfile\b|\bnetsh\s+advfirewall\s+set\b/i, "Cambios de firewall"],
  [/\bStop-Service\b.*(WinRM|AmazonSSMAgent|sshd|EventLog)|\bSet-Service\b.*(WinRM|AmazonSSMAgent|sshd|EventLog)/i, "Manipulación de servicios críticos"],
  [/\breg\s+(delete|add)\b.*(\\sam|\\security|\\system|\\policies)/i, "Cambio de claves críticas del registro"],
];

function validateCommand(command: string, osType: OsType): ValidationResult {
  const trimmed = command.trim();

  if (!trimmed) return { blocked: true, reason: "El comando está vacío" };
  if (trimmed.length > maxCommandLength) {
    return { blocked: true, reason: `El comando supera ${maxCommandLength} caracteres` };
  }

  const patterns = [
    ...sharedDangerousPatterns,
    ...(osType === "linux" ? linuxDangerousPatterns : windowsDangerousPatterns),
  ];

  for (const [pattern, reason] of patterns) {
    if (pattern.test(trimmed)) return { blocked: true, reason };
  }

  return { blocked: false };
}

function getAllAccounts(): { id: string; accessKey: string; secretKey: string }[] {
  const accounts: { id: string; accessKey: string; secretKey: string }[] = [];
  const env = process.env;

  Object.keys(env).forEach((key) => {
    const match = key.match(/^AWS_ACCOUNT_(\d+)_ID$/);
    if (!match) return;

    const index = match[1];
    const id = env[`AWS_ACCOUNT_${index}_ID`];
    const accessKey = resolveSecret(
      env[`AWS_ACCOUNT_${index}_ACCESS_KEY`] ||
      env[`AWS_ACCOUNT_${index}_ACCESS_KEY_ID`],
    );
    const secretKey = resolveSecret(
      env[`AWS_ACCOUNT_${index}_SECRET_KEY`] ||
      env[`AWS_ACCOUNT_${index}_SECRET_ACCESS_KEY`],
    );

    if (id && accessKey && secretKey) accounts.push({ id, accessKey, secretKey });
  });

  return accounts;
}

function getCredentials(accountId: string) {
  const account = getAllAccounts().find((item) => item.id === accountId);
  if (!account) throw new Error(`Cuenta AWS no configurada: ${accountId}`);

  return {
    accessKeyId: account.accessKey,
    secretAccessKey: account.secretKey,
  };
}

async function waitForCommand(ssm: SSMClient, commandId: string, instanceId: string) {
  const maxAttempts = 30;
  const delay = 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      const result = await ssm.send(
        new GetCommandInvocationCommand({
          CommandId: commandId,
          InstanceId: instanceId,
        }),
      );

      if (
        result.Status === "Success" ||
        result.Status === "Failed" ||
        result.Status === "Cancelled" ||
        result.Status === "TimedOut"
      ) {
        return result;
      }
    } catch {
      continue;
    }
  }

  throw new Error("Timeout esperando el resultado de SSM");
}

function mapSsmStatus(status?: string): ExecutionStatus {
  if (status === "Success") return "success";
  if (status === "TimedOut") return "timedOut";
  if (status === "Cancelled") return "cancelled";
  if (status === "Failed") return "failed";
  return "error";
}

function safeTarget(target: CommandTarget) {
  return {
    instanceId: target.instanceId,
    accountId: target.accountId,
    osType: target.osType,
  };
}

function parseTarget(value: unknown): CommandTarget | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const instanceId = typeof candidate.instanceId === "string" ? candidate.instanceId.trim() : "";
  const accountId = typeof candidate.accountId === "string" ? candidate.accountId.trim() : "";
  const osType = candidate.osType === "linux" || candidate.osType === "windows" ? candidate.osType : undefined;
  const safeIdentifier = /^[A-Za-z0-9_.:/-]{1,128}$/;

  if (!safeIdentifier.test(instanceId) || !safeIdentifier.test(accountId)) return null;
  return {
    instanceId,
    accountId,
    accountName: typeof candidate.accountName === "string" ? candidate.accountName.slice(0, 256) : undefined,
    name: typeof candidate.name === "string" ? candidate.name.slice(0, 256) : undefined,
    osType,
  };
}

async function runOnTarget(target: CommandTarget, command: string, osType: OsType): Promise<CommandResult> {
  const started = Date.now();

  try {
    const ssm = new SSMClient({
      region,
      credentials: getCredentials(target.accountId),
    });

    const send = await ssm.send(
      new SendCommandCommand({
        InstanceIds: [target.instanceId],
        DocumentName: osType === "linux" ? "AWS-RunShellScript" : "AWS-RunPowerShellScript",
        TimeoutSeconds: 3600,
        Parameters: {
          commands: [command],
        },
      }),
    );

    const commandId = send.Command?.CommandId;
    if (!commandId) throw new Error("SSM no retornó CommandId");

    const result = await waitForCommand(ssm, commandId, target.instanceId);

    return {
      instanceId: target.instanceId,
      accountId: target.accountId,
      accountName: target.accountName,
      name: target.name,
      status: mapSsmStatus(result.Status),
      commandId,
      output: redactSensitiveText(result.StandardOutputContent || "", 4_000),
      error: redactSensitiveText(result.StandardErrorContent || "", 1_000),
      durationMs: Date.now() - started,
    };
  } catch {
    return {
      instanceId: target.instanceId,
      accountId: target.accountId,
      accountName: target.accountName,
      name: target.name,
      status: "error",
      error: "No se pudo completar la ejecución en SSM",
      durationMs: Date.now() - started,
    };
  }
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const guard = await requireApiSession("command:execute", req);
  if (guard.response) return guard.response;
  const session = guard.session;
  const context = getRequestContext(req);

  if (!hasAuditHashSecret()) {
    await recordAuditEvent({
      request: req,
      context,
      session,
      action: "command.failed",
      result: "error",
      statusCode: 503,
      durationMs: Date.now() - startedAt,
      metadata: { code: "audit_hash_unavailable" },
    }).catch(() => undefined);
    return NextResponse.json({ error: "Ejecución no disponible" }, { status: 503 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const command = typeof body.command === "string" ? body.command : "";
    const osType = body.osType === "linux" || body.osType === "windows" ? body.osType : undefined;
    const rawInstances = Array.isArray(body.instances) ? body.instances : [];
    const instances = rawInstances.map(parseTarget);
    const hasInvalidTarget = instances.some((target): target is null => target === null);
    const targets = instances.filter((target): target is CommandTarget => target !== null);

    if (!osType) return NextResponse.json({ error: "Sistema operativo inválido" }, { status: 400 });
    if (rawInstances.length === 0) return NextResponse.json({ error: "Selecciona al menos una instancia" }, { status: 400 });
    if (rawInstances.length > maxTargets) {
      return NextResponse.json({ error: `Máximo ${maxTargets} instancias por ejecución` }, { status: 400 });
    }
    if (hasInvalidTarget) return NextResponse.json({ error: "Target inválido" }, { status: 400 });

    const mixedOsTarget = targets.find((target) => target.osType && target.osType !== osType);
    if (mixedOsTarget) {
      return NextResponse.json({ error: "No mezcles Linux y Windows en la misma ejecución" }, { status: 400 });
    }

    const trimmedCommand = command.trim();
    const commandHash = hashAuditValue(trimmedCommand);
    const auditMetadata = {
      osType,
      commandHash,
      commandPreview: redactCommandPreview(trimmedCommand),
      targetCount: targets.length,
      targets: targets.map(safeTarget),
    };

    // This event is the fail-closed commit point before any SSM call.
    await recordAuditEvent({
      request: req,
      context,
      session,
      action: "command.request",
      result: "success",
      statusCode: 202,
      durationMs: Date.now() - startedAt,
      metadata: auditMetadata,
    });

    const validation = validateCommand(trimmedCommand, osType);
    if (validation.blocked) {
      await recordAuditEvent({
        request: req,
        context,
        session,
        action: "command.blocked",
        result: "denied",
        statusCode: 403,
        durationMs: Date.now() - startedAt,
        metadata: { ...auditMetadata, reason: validation.reason },
      }).catch(() => undefined);
      return NextResponse.json({ error: "Comando bloqueado por política de seguridad", reason: validation.reason }, { status: 403 });
    }

    const results = await Promise.all(targets.map((target) => runOnTarget(target, trimmedCommand, osType)));
    const successCount = results.filter((result) => result.status === "success").length;
    const aggregateResult = successCount === results.length
      ? "success"
      : successCount > 0
        ? "partial"
        : "failure";
    const action = aggregateResult === "success" || aggregateResult === "partial"
      ? "command.completed"
      : "command.failed";

    await recordAuditEvent({
      request: req,
      context,
      session,
      action,
      result: aggregateResult,
      statusCode: aggregateResult === "success" ? 200 : 502,
      durationMs: Date.now() - startedAt,
      metadata: {
        ...auditMetadata,
        successCount,
        failureCount: results.length - successCount,
        results: results.map((result) => ({
          instanceId: result.instanceId,
          accountId: result.accountId,
          status: result.status,
          durationMs: result.durationMs,
        })),
      },
    }).catch(() => undefined);

    return NextResponse.json(results);
  } catch {
    await recordAuditEvent({
      request: req,
      context,
      session,
      action: "command.failed",
      result: "error",
      statusCode: 500,
      durationMs: Date.now() - startedAt,
      metadata: { code: "command_request_failed" },
    }).catch(() => undefined);
    return NextResponse.json({ error: "No se pudo ejecutar el comando" }, { status: 500 });
  }
}

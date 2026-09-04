import type { Session } from "next-auth";

export type AuditResult = "success" | "failure" | "denied" | "error" | "partial";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type AuditActor = {
  userId: string;
  email: string;
  name: string;
  role: string;
};

export type AuditRequestContext = {
  requestId: string;
  occurredAt: string;
  method: string;
  route: string;
  ip: string;
  userAgent: string;
};

export type AuditEventInput = {
  session: Session;
  action: string;
  result: AuditResult;
  statusCode: number;
  durationMs?: number;
  metadata?: unknown;
  request?: Request;
  context?: AuditRequestContext;
};

export type AuditEventSummary = {
  id: string;
  occurredAt: string;
  requestId: string;
  actor: AuditActor;
  action: string;
  method: string;
  route: string;
  result: AuditResult;
  statusCode: number;
  ip: string;
  userAgent: string;
  durationMs: number | null;
};

export type AuditEventDetail = AuditEventSummary & {
  metadata: Record<string, JsonValue>;
};

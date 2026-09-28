import type { Session } from "next-auth";

export type AuditResult = "success" | "failure" | "denied" | "error" | "partial";
export type AuditCategory =
  | "api"
  | "ui"
  | "navigation"
  | "authentication"
  | "data"
  | "command"
  | "configuration"
  | "export"
  | "system";
export type AuditSource = "server" | "client" | "job" | "cli";
export type AuditActorType = "user" | "anonymous" | "system";
export type AuditConfidence = "authoritative" | "observed";

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
  clientSessionId?: string;
  navigationId?: string;
  interactionId?: string;
};

export type AuditEventInput = {
  id?: string;
  session?: Session | null;
  actor?: AuditActor;
  actorType?: AuditActorType;
  action: string;
  category?: AuditCategory;
  source?: AuditSource;
  confidence?: AuditConfidence;
  authMethod?: string;
  targetType?: string;
  targetId?: string;
  operationId?: string;
  clientSessionId?: string;
  navigationId?: string;
  interactionId?: string;
  parentEventId?: string;
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
  recordedAt: string;
  requestId: string;
  actor: AuditActor;
  actorType: AuditActorType;
  action: string;
  category: AuditCategory;
  source: AuditSource;
  confidence: AuditConfidence;
  targetType: string | null;
  targetId: string | null;
  operationId: string | null;
  clientSessionId: string | null;
  navigationId: string | null;
  interactionId: string | null;
  method: string;
  route: string;
  result: AuditResult;
  statusCode: number;
  ip: string;
  userAgent: string;
  durationMs: number | null;
};

export type AuditEventDetail = AuditEventSummary & {
  parentEventId: string | null;
  authMethod: string | null;
  metadata: Record<string, JsonValue>;
};

export type AuditClientEvent = {
  id: string;
  action: string;
  category: Extract<AuditCategory, "ui" | "navigation" | "export">;
  route: string;
  result?: AuditResult;
  durationMs?: number;
  metadata?: Record<string, JsonValue>;
  operationId?: string;
  interactionId?: string;
};

export type AuditClientBatch = {
  clientSessionId: string;
  navigationId: string;
  operationId?: string;
  events: AuditClientEvent[];
};

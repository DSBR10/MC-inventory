"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import type {
  AuditCategory,
  AuditClientBatch,
  AuditClientEvent,
  AuditResult,
  JsonValue,
} from "@/types/audit";

const ENDPOINT = "/api/audit/events";
const MAX_QUEUE_SIZE = 500;
const FLUSH_DELAY_MS = 1_500;
const BATCH_SIZE = 25;

type ClientEventOptions = {
  category?: Extract<AuditCategory, "ui" | "navigation" | "export">;
  result?: AuditResult;
  durationMs?: number;
  metadata?: Record<string, JsonValue>;
  operationId?: string;
};

type Runtime = {
  active: boolean;
  authenticated: boolean;
  pathname: string;
  module: string;
  clientSessionId: string;
  navigationId: string;
  lastPathname: string;
};

const runtime: Runtime = {
  active: false,
  authenticated: false,
  pathname: "/",
  module: "global",
  clientSessionId: "",
  navigationId: "",
  lastPathname: "",
};

let queue: AuditClientEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let listenersInstalled = false;
let originalBrowserFetch: typeof window.fetch | null = null;
let lastInteractionId: string | undefined;
let lastInteractionAt = 0;

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function canonicalPath(pathname: string) {
  return pathname
    .replace(/\/auditoria\/[0-9a-f]{8}-[0-9a-f-]{27,}/i, "/auditoria/:id")
    .slice(0, 512) || "/";
}

function moduleForPath(pathname: string) {
  if (pathname === "/") return "inventory";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/servidores")) return "servers";
  if (pathname.startsWith("/monitoreo")) return "monitoring";
  if (pathname.startsWith("/billing")) return "billing";
  if (pathname.startsWith("/comandos")) return "commands";
  if (pathname.startsWith("/auditoria")) return "audit";
  if (pathname.startsWith("/profile")) return "profile";
  if (pathname.startsWith("/terminal")) return "terminal";
  if (pathname.startsWith("/login") || pathname.startsWith("/auth")) return "login";
  return "global";
}

function getClientSessionId() {
  const key = "mc-audit-client-session";
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const created = createId();
    window.sessionStorage.setItem(key, created);
    return created;
  } catch {
    return runtime.clientSessionId || createId();
  }
}

function safeLabel(value: string | null | undefined) {
  if (!value) return undefined;
  const normalized = value
    .replace(/\s+/g, " ")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[ip]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "[id]")
    .replace(/\b[0-9a-z_-]{32,}\b/gi, "[id]")
    .trim();
  return normalized ? normalized.slice(0, 96) : undefined;
}

function safeField(value: string | null | undefined) {
  if (!value) return undefined;
  const normalized = value.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 64);
  return normalized || undefined;
}

function elementFromEvent(event: Event) {
  const path = event.composedPath();
  for (const item of path) {
    if (item instanceof HTMLElement && item.closest("[data-audit-ignore]")) return null;
  }

  for (const item of path) {
    if (!(item instanceof HTMLElement)) continue;
    if (item.matches("[data-audit-action], [data-audit-clickable], button, a[href], input, select, textarea, tr, [role='button'], [role='tab'], [role='checkbox'], [role='switch'], [draggable='true']")) {
      return item;
    }
  }

  for (const item of path) {
    if (item instanceof HTMLElement && item !== document.body && item !== document.documentElement) return item;
  }
  return null;
}

function metadataForElement(element: HTMLElement) {
  const tag = element.tagName.toLowerCase();
  const targetType = element.getAttribute("data-audit-target") || tag;
  const field = safeField(
    element.getAttribute("data-audit-field")
    || element.getAttribute("name")
    || element.getAttribute("id")
    || element.getAttribute("type"),
  );
  const ariaLabel = safeLabel(element.getAttribute("data-audit-label") || element.getAttribute("aria-label") || element.getAttribute("title"));
  const textLabel = tag === "button" || tag === "a" || element.getAttribute("role") === "button"
    ? safeLabel(element.textContent)
    : undefined;
  const metadata: Record<string, JsonValue> = { element: tag, targetType };
  const label = ariaLabel || textLabel;
  if (label) metadata.label = label;
  if (field) metadata.field = field;

  if (tag === "a") {
    try {
      const href = new URL(element.getAttribute("href") || "", window.location.origin);
      if (href.origin === window.location.origin) metadata.hrefPath = canonicalPath(href.pathname);
    } catch {
      // Un href inválido no aporta información confiable.
    }
  }

  return metadata;
}

function enqueue(event: AuditClientEvent) {
  if (!runtime.active || queue.length >= MAX_QUEUE_SIZE) return;
  queue.push(event);
  scheduleFlush();
}

export function trackClientAuditEvent(action: string, options: ClientEventOptions = {}) {
  if (!runtime.active) return;
  const interactionId = createId();
  const event: AuditClientEvent = {
    id: createId(),
    action,
    category: options.category || "ui",
    route: runtime.pathname,
    result: options.result || "success",
    durationMs: options.durationMs,
    metadata: {
      module: runtime.module,
      ...(options.metadata || {}),
    },
    operationId: options.operationId,
    interactionId,
  };
  lastInteractionId = interactionId;
  lastInteractionAt = Date.now();
  enqueue(event);
}

function requeue(batch: AuditClientEvent[]) {
  queue = [...batch, ...queue].slice(0, MAX_QUEUE_SIZE);
  scheduleFlush();
}

async function flushAuditQueue(useBeacon = false) {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (queue.length === 0) return;

  const events = queue.splice(0, BATCH_SIZE);
  const payload: AuditClientBatch = {
    clientSessionId: runtime.clientSessionId,
    navigationId: runtime.navigationId,
    events,
  };

  if (useBeacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const accepted = navigator.sendBeacon(ENDPOINT, new Blob([JSON.stringify(payload)], { type: "application/json" }));
    if (accepted) return;
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
      keepalive: true,
    });
    if (response.status === 401 || response.status === 403) {
      queue = [];
      return;
    }
    if (!response.ok) requeue(events);
  } catch {
    requeue(events);
  }
}

function scheduleFlush() {
  if (flushTimer || queue.length >= BATCH_SIZE) {
    void flushAuditQueue();
    return;
  }
  flushTimer = setTimeout(() => void flushAuditQueue(), FLUSH_DELAY_MS);
}

function recordClick(event: MouseEvent) {
  if (!event.isTrusted) return;
  const element = elementFromEvent(event);
  if (!element) return;
  const action = element.getAttribute("data-audit-action")
    || (element.tagName.toLowerCase() === "a" ? "navigation.link" : "ui.click");
  trackClientAuditEvent(action, { metadata: metadataForElement(element) });
}

const changeTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

function recordChange(event: Event) {
  if (!(event.target instanceof HTMLElement) || !event.isTrusted) return;
  const element = event.target;
  const action = element.getAttribute("data-audit-change") || "ui.change";
  const metadata = metadataForElement(element);
  if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) {
    metadata.control = element.type || element.tagName.toLowerCase();
    if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
      metadata.checked = element.checked;
    }
    if (element instanceof HTMLSelectElement) metadata.selectedCount = element.selectedOptions.length;
  }

  const existing = changeTimers.get(element);
  if (existing) clearTimeout(existing);
  changeTimers.set(element, setTimeout(() => trackClientAuditEvent(action, { metadata }), 600));
}

function recordKey(event: KeyboardEvent) {
  if (!event.isTrusted || (event.key !== "Enter" && event.key !== "Escape")) return;
  const element = event.target instanceof HTMLElement ? event.target : null;
  if (!element) return;
  trackClientAuditEvent(element.getAttribute("data-audit-key-action") || "ui.key", {
    metadata: { ...metadataForElement(element), key: event.key },
  });
}

function recordDrag(event: DragEvent) {
  if (!event.isTrusted || !(event.target instanceof HTMLElement)) return;
  trackClientAuditEvent(event.target.getAttribute("data-audit-drag") || "ui.drag", {
    metadata: metadataForElement(event.target),
  });
}

function installFetchInterceptor() {
  if (originalBrowserFetch) return;
  originalBrowserFetch = window.fetch.bind(window);
  const originalFetch = originalBrowserFetch;

  window.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const shouldAudit = url.origin === window.location.origin
      && url.pathname.startsWith("/api/")
      && url.pathname !== ENDPOINT
      && !url.pathname.startsWith("/api/auth/");
    if (!shouldAudit) return originalFetch(request);

    const requestId = createId();
    const headers = new Headers(request.headers);
    if (!headers.has("x-request-id")) headers.set("x-request-id", requestId);
    if (runtime.clientSessionId) headers.set("x-audit-client-session", runtime.clientSessionId);
    if (runtime.navigationId) headers.set("x-audit-navigation-id", runtime.navigationId);
    if (lastInteractionId && Date.now() - lastInteractionAt <= 30_000) {
      headers.set("x-audit-interaction-id", lastInteractionId);
    }
    const auditedRequest = new Request(request, { headers });
    const startedAt = performance.now();
    try {
      const response = await originalFetch(auditedRequest);
      const status = response.status;
      trackClientAuditEvent("api.request", {
        category: "ui",
        result: status === 401 || status === 403 ? "denied" : status >= 500 ? "error" : status >= 400 ? "failure" : "success",
        durationMs: Math.round(performance.now() - startedAt),
        metadata: {
          method: request.method,
          path: canonicalPath(url.pathname),
          status,
          requestId,
        },
      });
      return response;
    } catch (error) {
      trackClientAuditEvent("api.request", {
        category: "ui",
        result: "error",
        durationMs: Math.round(performance.now() - startedAt),
        metadata: { method: request.method, path: canonicalPath(url.pathname), status: 0, requestId },
      });
      throw error;
    }
  };
}

function installListeners() {
  if (listenersInstalled || typeof document === "undefined") return;
  listenersInstalled = true;
  installFetchInterceptor();
  document.addEventListener("click", recordClick, true);
  document.addEventListener("change", recordChange, true);
  document.addEventListener("keydown", recordKey, true);
  document.addEventListener("dragend", recordDrag, true);
  window.addEventListener("pagehide", () => void flushAuditQueue(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushAuditQueue(true);
  });
}

export function AuditClientProvider() {
  const pathname = usePathname() || "/";
  const { data: session, status } = useSession();
  const canonical = canonicalPath(pathname);
  const userId = session?.user?.id || "";

  useEffect(() => {
    runtime.clientSessionId = getClientSessionId();
    runtime.pathname = canonical;
    runtime.module = moduleForPath(canonical);
    runtime.authenticated = status === "authenticated";
    runtime.active = runtime.authenticated || canonical === "/login";
    installListeners();

    if (runtime.active && runtime.lastPathname !== canonical) {
      const previousPath = runtime.lastPathname;
      runtime.navigationId = createId();
      runtime.lastPathname = canonical;
      trackClientAuditEvent("navigation.page_view", {
        category: "navigation",
        metadata: { module: runtime.module, from: previousPath || null, to: canonical },
      });
    }
  }, [canonical, status, userId]);

  useEffect(() => {
    if (status === "unauthenticated") {
      try {
        window.sessionStorage.removeItem("mc-audit-client-session");
      } catch {
        // sessionStorage puede estar bloqueado.
      }
      runtime.clientSessionId = createId();
      runtime.authenticated = false;
    }
  }, [status]);

  return null;
}

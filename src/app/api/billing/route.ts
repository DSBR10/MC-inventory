import { NextRequest, NextResponse } from "next/server";
import { recordApiAudit } from "@/lib/audit/server";
import { requireApiSession } from "@/lib/auth/server";
import { getAWSBilling } from "@/lib/billing/aws";
import { applyBillingFilters } from "@/lib/billing/filters";
import { groupBillingData } from "@/lib/billing/grouping";
import { normalizeBillingData } from "@/lib/billing/normalize";
import { readBillingCache, writeBillingCache } from "@/lib/billing/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CACHE_TTL = 100 * 60 * 10;

let refreshing = false;

async function buildBilling() {
  const awsBilling = await getAWSBilling();
  return normalizeBillingData(awsBilling);
}

async function refreshBilling() {
  try {
    console.log("BILLING BACKGROUND REFRESH START");
    const data = await buildBilling();
    writeBillingCache({ timestamp: Date.now(), data });
    console.log("BILLING BACKGROUND REFRESH DONE");
  } catch (err) {
    console.error("BILLING BACKGROUND REFRESH ERROR:", err);
  }
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const guard = await requireApiSession("billing:view", request);
    if (guard.response) return guard.response;

    const { searchParams } = new URL(request.url);

    const filters = {
      start:     searchParams.get("start")    || undefined,
      end:       searchParams.get("end")      || undefined,
      provider:  searchParams.get("provider") || undefined,
      service:   searchParams.get("service")  || undefined,
      account:   searchParams.get("account")  || undefined,
      tagKey:    searchParams.get("tagKey")   || undefined,
      tagValue:  searchParams.get("tagValue") || undefined,
      groupBy:   searchParams.get("groupBy")  as any
    };

    /* ── CACHE ── */
    let normalized;
    const cached = readBillingCache();

    if (cached) {
      const age = Date.now() - cached.timestamp;
      console.log(`BILLING CACHE AGE: ${Math.floor(age / 1000)}s`);

      if (age > CACHE_TTL && !refreshing) {
        refreshing = true;
        refreshBilling().finally(() => { refreshing = false; });
      }

      normalized = cached.data;

    } else {
      console.log("NO BILLING CACHE FOUND");
      refreshing = true;
      normalized = await buildBilling();
      writeBillingCache({ timestamp: Date.now(), data: normalized });
      refreshing = false;
    }

    /* ── FILTERS ── */
    const filtered = applyBillingFilters(normalized, filters);

    /* ── GROUPING ── */
    const grouped = filters.groupBy
      ? groupBillingData(filtered, filters.groupBy)
      : null;

    /* ── FACETS ── */
    const providers = Array.from(new Set(filtered.map((i) => i.provider))).sort();
    const services  = Array.from(new Set(filtered.map((i) => i.service))).sort();
    const accounts  = Array.from(new Set(filtered.map((i) => i.accountName))).sort();

    const tagFacets: Record<string, string[]> = {};
    for (const item of filtered) {
      for (const [key, value] of Object.entries(item.tags || {})) {
        if (!tagFacets[key]) tagFacets[key] = [];
        if (value && !tagFacets[key].includes(value)) tagFacets[key].push(value);
      }
    }
    Object.keys(tagFacets).forEach((k) => tagFacets[k].sort());

    /* ── TOTAL ── */
    const total = filtered.reduce((acc, item) => acc + item.cost, 0);

    await recordApiAudit(request, guard.session, {
      action: "billing.view",
      result: "success",
      statusCode: 200,
      startedAt,
      metadata: { source: cached ? "cache" : "fresh", itemCount: filtered.length },
    });
    return NextResponse.json({
      success: true,
      source: cached ? "cache" : "fresh",
      timestamp: cached?.timestamp ?? Date.now(),
      refreshing,
      filters,
      total,
      count: filtered.length,
      grouped,
      facets: { providers, services, accounts, tags: tagFacets },
      data: filtered
    });

  } catch {
    refreshing = false;
    const guard = await requireApiSession(undefined, request);
    if (guard.session) {
      await recordApiAudit(request, guard.session, {
        action: "billing.view",
        result: "error",
        statusCode: 500,
        startedAt,
      });
    }
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

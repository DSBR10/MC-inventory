import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/server";

import { getAWSInventory } from "@/lib/aws";

import {
  getHuaweiECSInventory
} from "@/lib/huawei/ecs";

import {
  getHuaweiRDSInventory
} from "@/lib/huawei/rds";

import {
  getHuaweiVPCInventory
} from "@/lib/huawei/vpc";

import {
  getHuaweiSubnetInventory
} from "@/lib/huawei/subnet";

import {
  getHuaweiOBSInventory
} from "@/lib/huawei/obs";

import {
  getHuaweiELBInventory
} from "@/lib/huawei/elb";

import {
  getHuaweiCCEInventory
} from "@/lib/huawei/cce";

import {
  getHuaweiCDNInventory
} from "@/lib/huawei/cdn";

import {
  getHuaweiDDSInventory
} from "@/lib/huawei/dds";

import {
  enrichRelationships
} from "@/lib/inventory/enrichRelationships";

import {

  readInventoryCache,
  writeInventoryCache

} from "@/lib/inventory/cache";

export const dynamic =
  "force-dynamic";

const CACHE_TTL =
  100 * 60 * 10;

/* ───────────────────────────── */
/* GLOBAL REFRESH LOCK */
/* ───────────────────────────── */

let refreshing =
  false;

let lastRefresh =
  0;

/* ───────────────────────────── */
/* BUILD INVENTORY */
/* ───────────────────────────── */

async function buildInventory() {

  console.time(
    "inventory-build"
  );

  // 1. Primero obtener CCE para extraer los server IDs de los nodos
  let cceInventory: any[] = [];
  const cceNodeServerIds: string[] = [];

  try {
    cceInventory = await getHuaweiCCEInventory();

    // Extraer server IDs de todos los nodos CCE
    for (const item of cceInventory) {
      if (item.children && Array.isArray(item.children)) {
        for (const child of item.children) {
          if (child.raw?.status?.serverId) {
            cceNodeServerIds.push(child.raw.status.serverId);
          }
        }
      }
    }

    console.log(`✅ [CCE]: ${cceInventory.length} clusters, ${cceNodeServerIds.length} nodos detectados`);
  } catch (error) {
    console.error(`❌ INVENTORY FETCH FAILED [CCE]:`, error);
  }

  // 2. Luego obtener el resto de servicios, pasando los IDs a excluir en ECS
  const results = await Promise.allSettled([

    getAWSInventory(),

    getHuaweiECSInventory(cceNodeServerIds),
    getHuaweiRDSInventory(),
    getHuaweiVPCInventory(),
    getHuaweiSubnetInventory(),
    getHuaweiOBSInventory(),
    getHuaweiELBInventory(),
    getHuaweiCDNInventory(),
    getHuaweiDDSInventory()

  ]);

  // Extract successful results, log failures
  const getData = (result: PromiseSettledResult<any[]>, name: string) => {
    if (result.status === "fulfilled") {
      const data = result.value || [];
      console.log(`✅ [${name}]: ${data.length} items fetched`);
      return data;
    }
    console.error(`❌ INVENTORY FETCH FAILED [${name}]:`, result.reason);
    return [];
  };

  const allInventory = [

    ...getData(results[0], "AWS"),

    ...getData(results[1], "Huawei-ECS"),
    ...getData(results[2], "Huawei-RDS"),
    ...getData(results[3], "Huawei-VPC"),
    ...getData(results[4], "Huawei-Subnet"),
    ...getData(results[5], "Huawei-OBS"),
    ...getData(results[6], "Huawei-ELB"),
    ...cceInventory, // Ya obtenido arriba
    ...getData(results[7], "Huawei-CDN"),
    ...getData(results[8], "Huawei-DDS")

  ];

  const enriched =
    enrichRelationships(
      allInventory
    );

  console.timeEnd(
    "inventory-build"
  );

  return enriched;

}

/* ───────────────────────────── */
/* BACKGROUND REFRESH */
/* ───────────────────────────── */

async function refreshInventory() {

  try {

    console.log(
      "BACKGROUND REFRESH START"
    );

    const inventory =
      await buildInventory();

    writeInventoryCache({

      timestamp:
        Date.now(),

      data:
        inventory

    });

    lastRefresh =
      Date.now();

    console.log(
      "BACKGROUND REFRESH DONE"
    );

  } catch (err) {

    console.error(
      "BACKGROUND REFRESH ERROR:",
      err
    );

  }

}

/* ───────────────────────────── */
/* API */
/* ───────────────────────────── */

export async function GET() {

  try {
    const guard = await requireApiSession("inventory:view");
    if (guard.response) return guard.response;

    const cached =
      readInventoryCache();

    /* ───────────────────────── */
    /* CACHE EXISTS */
    /* ───────────────────────── */

    if (cached) {

      const age =
        Date.now() -
        cached.timestamp;

      console.log(
        `CACHE AGE: ${Math.floor(age / 1000)}s`
      );

      /* ─────────────────────── */
      /* AUTO REFRESH BG */
      /* ─────────────────────── */

      const shouldRefresh =

        age > CACHE_TTL &&

        !refreshing;

      if (shouldRefresh) {

        refreshing = true;

        refreshInventory()
          .finally(() => {

            refreshing = false;

          });

      }

      return NextResponse.json({

        source:
          "cache",

        timestamp:
          cached.timestamp,

        refreshing,

        data:
          cached.data

      });

    }

    /* ───────────────────────── */
    /* FIRST LOAD */
    /* ───────────────────────── */

    console.log(
      "NO CACHE FOUND"
    );

    refreshing = true;

    const inventory =
      await buildInventory();

    writeInventoryCache({

      timestamp:
        Date.now(),

      data:
        inventory

    });

    refreshing = false;

    return NextResponse.json({

      source:
        "fresh",

      timestamp:
        Date.now(),

      refreshing:
        false,

      data:
        inventory

    });

  } catch (error) {

    refreshing = false;

    console.error(
      "INVENTORY ERROR:",
      error
    );

    return NextResponse.json(

      {

        error:
          "Error fetching inventory"

      },

      {

        status: 500

      }

    );

  }

}

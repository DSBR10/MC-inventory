import { NextResponse } from "next/server";

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

  const [

    awsInventory,

    huaweiECS,
    huaweiRDS,
    huaweiVPC,
    huaweiSubnet,
    huaweiOBS,
    huaweiELB,
    huaweiCCE,
    huaweiCDN,
    huaweiDDS

  ] = await Promise.all([

    getAWSInventory(),

    getHuaweiECSInventory(),
    getHuaweiRDSInventory(),
    getHuaweiVPCInventory(),
    getHuaweiSubnetInventory(),
    getHuaweiOBSInventory(),
    getHuaweiELBInventory(),
    getHuaweiCCEInventory(),
    getHuaweiCDNInventory(),
    getHuaweiDDSInventory()

  ]);

  const allInventory = [

    ...awsInventory,

    ...huaweiECS,
    ...huaweiRDS,
    ...huaweiVPC,
    ...huaweiSubnet,
    ...huaweiOBS,
    ...huaweiELB,
    ...huaweiCCE,
    ...huaweiCDN,
    ...huaweiDDS

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
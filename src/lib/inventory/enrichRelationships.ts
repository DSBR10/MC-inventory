import {
  InventoryItem,
  Relationship
} from "@/types/inventory";

import {
  calculateRiskLevel
} from "./risk";

import {
  normalizeInventory
} from "./normalize";

export function enrichRelationships(
  rawInventory: InventoryItem[]
): InventoryItem[] {

  const inventory =
    normalizeInventory(
      rawInventory
    );

  const itemMap =
    new Map<string, InventoryItem>();

  inventory.forEach((item) => {

    itemMap.set(
      item.id,
      item
    );

  });

  return inventory.map((item) => {

    const relationships: Relationship[] = [

      ...(item.relationships || [])

    ];

    /* ───────────────────────── */
    /* SUBNET */
    /* ───────────────────────── */

    if (item.subnetId) {

      const subnet =
        itemMap.get(item.subnetId);

      if (subnet) {

        relationships.push({

          type:
            "CONNECTED_TO_SUBNET",

          targetId:
            subnet.id,

          targetName:
            subnet.name,

          targetService:
            subnet.service

        });

      }

    }

    /* ───────────────────────── */
    /* VPC */
    /* ───────────────────────── */

    if (item.vpcId) {

      const vpc =
        itemMap.get(item.vpcId);

      if (vpc) {

        relationships.push({

          type:
            "CONNECTED_TO_VPC",

          targetId:
            vpc.id,

          targetName:
            vpc.name,

          targetService:
            vpc.service

        });

      }

    }

    /* ───────────────────────── */
    /* CLUSTER CHILDREN */
    /* ───────────────────────── */

    for (const child of (item.children || [])) {

      relationships.push({

        type:
          "HAS_CHILD",

        targetId:
          child.id,

        targetName:
          child.name,

        targetService:
          child.service

      });

    }

    /* ───────────────────────── */
    /* TARGET GROUPS */
    /* ───────────────────────── */

    for (const tg of (item.targetGroups || [])) {

      for (const target of (tg.targets || [])) {

        relationships.push({

          type:
            "TARGETS",

          targetId:
            target.id || "N/A"

        });

      }

    }

    /* ───────────────────────── */
    /* PUBLIC EXPOSURE */
    /* ───────────────────────── */

    let publiclyExposed =
      false;

    if (
      item.publicIp &&
      item.publicIp !== "N/A"
    ) {

      publiclyExposed =
        true;

    }

    if (
      item.internetFacing
    ) {

      publiclyExposed =
        true;

    }

    for (const sg of (item.securityGroups || [])) {

      for (const rule of (sg.inboundRules || [])) {

        if (
          rule.cidr === "0.0.0.0/0"
        ) {

          publiclyExposed =
            true;

        }

      }

    }

    return {

      ...item,

      publiclyExposed,

      riskLevel:
        calculateRiskLevel(item),

      relationships

    };

  });

}
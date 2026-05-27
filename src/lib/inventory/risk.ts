import {
  InventoryItem,
  RiskLevel
} from "@/types/inventory";

export function calculateRiskLevel(
  item: InventoryItem
): RiskLevel {

  let score = 0;

  if (
    item.publicIp &&
    item.publicIp !== "N/A"
  ) {
    score += 2;
  }

  if (
    item.internetFacing
  ) {
    score += 2;
  }

  for (const sg of (item.securityGroups || [])) {

    for (const rule of (sg.inboundRules || [])) {

      const publicAccess =
        rule.cidr === "0.0.0.0/0";

      if (!publicAccess) {
        continue;
      }

      score += 2;

      const dangerousPorts = [

        22,
        3389,
        3306,
        5432,
        6379,
        27017

      ];

      if (
        dangerousPorts.includes(
          rule.fromPort || 0
        )
      ) {
        score += 4;
      }

      if (
        rule.protocol === "-1"
      ) {
        score += 6;
      }

    }

  }

  if (score >= 10) {
    return "CRITICAL";
  }

  if (score >= 7) {
    return "HIGH";
  }

  if (score >= 4) {
    return "MEDIUM";
  }

  if (score >= 1) {
    return "LOW";
  }

  return "SAFE";

}
import { InventoryItem } from "@/types/inventory";

export function normalizeInventoryItem(
  item: InventoryItem
): InventoryItem {

  const normalized: InventoryItem = {
    ...item,

    provider:
      item.provider || "UNKNOWN",

    resourceType:
      item.resourceType ||
      item.service,

    host:
      item.host || "N/A",

    status:
      normalizeStatus(item.status),

    topologyType:
      normalizeTopology(item),

    tags:
      item.tags || {},

    relationships:
      item.relationships || [],

    securityGroups:
      item.securityGroups || [],

    listeners:
      item.listeners || [],

    targetGroups:
      item.targetGroups || [],

    children:
      item.children || []
  };

  return normalized;

}

export function normalizeInventory(
  inventory: InventoryItem[]
): InventoryItem[] {

  return inventory.map(
    normalizeInventoryItem
  );

}

function normalizeStatus(
  status?: string
): string {

  if (!status) {
    return "UNKNOWN";
  }

  const value =
    status.toLowerCase();

  if (
    [
      "active",
      "running",
      "available",
      "ok"
    ].includes(value)
  ) {
    return "running";
  }

  if (
    [
      "shutdown",
      "shutoff",
      "stopped"
    ].includes(value)
  ) {
    return "stopped";
  }

  return value;

}

function normalizeTopology(
  item: InventoryItem
): string {

  if (
    item.service === "ELB" ||
    item.service === "ALB" ||
    item.service === "NLB"
  ) {
    return "entrypoint";
  }

  if (
    item.service === "ECS" ||
    item.service === "EC2" ||
    item.service === "CCE Node"
  ) {
    return "compute";
  }

  if (
    item.service === "VPC" ||
    item.service === "Subnet"
  ) {
    return "network";
  }

  if (
    item.service === "RDS" ||
    item.service === "DDS"
  ) {
    return "database";
  }

  if (
    item.service === "OBS" ||
    item.service === "S3"
  ) {
    return "storage";
  }

  return "resource";

}
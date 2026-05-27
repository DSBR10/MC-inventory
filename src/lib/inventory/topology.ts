import { InventoryItem } from "@/types/inventory";

export function buildTopologyEdges(
  inventory: InventoryItem[]
) {

  const edges: any[] = [];

  for (const item of inventory) {

    for (const rel of (item.relationships || [])) {

      edges.push({

        source:
          item.id,

        target:
          rel.targetId,

        type:
          rel.type

      });

    }

  }

  return edges;

}

export function getConnectedResources(
  item: InventoryItem,
  inventory: InventoryItem[]
): InventoryItem[] {

  if (!item.relationships) {
    return [];
  }

  return inventory.filter((resource) =>

    item.relationships?.some(

      (rel) => rel.targetId === resource.id

    )

  );

}
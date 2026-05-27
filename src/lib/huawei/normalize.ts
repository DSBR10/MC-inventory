export function normalizeInventoryItem(item: any) {

  return {

    uniqueKey:
      item.uniqueKey ||

      `${item.provider}-${item.service}-${item.id}`,

    provider:
      item.provider || "UNKNOWN",

    accountName:
      item.accountName || "N/A",

    accountId:
      item.accountId || "N/A",

    service:
      item.service || "UNKNOWN",

    resourceType:
      item.resourceType || "resource",

    name:
      item.name || "N/A",

    id:
      item.id || "N/A",

    host:
      item.host || "N/A",

    privateIp:
      item.privateIp,

    publicIp:
      item.publicIp,

    status:
      item.status || "UNKNOWN",

    operatingSystem:
      item.operatingSystem || "N/A",

    platform:
      item.platform || "N/A",

    architecture:
      item.architecture || "N/A",

    instanceType:
      item.instanceType || "N/A",

    availabilityZone:
      item.availabilityZone || "N/A",

    vpcId:
      item.vpcId,

    subnetId:
      item.subnetId,

    topologyType:
      item.topologyType,

    publiclyExposed:
      item.publiclyExposed || false,

    internetFacing:
      item.internetFacing || false,

    securityGroups:
      item.securityGroups || [],

    listeners:
      item.listeners || [],

    children:
      item.children || [],

    tags:
      item.tags || {},

    raw:
      item.raw || {}

  };

}
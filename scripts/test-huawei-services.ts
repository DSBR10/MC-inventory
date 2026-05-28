// Script de diagnóstico para servicios de Huawei Cloud
import { config } from "dotenv";
import { resolve } from "path";

// Cargar variables de entorno desde .env.local
config({ path: resolve(process.cwd(), ".env.local") });

import { getHuaweiAccounts } from "../src/lib/huawei/accounts";
import { getHuaweiECSInventory } from "../src/lib/huawei/ecs";
import { getHuaweiRDSInventory } from "../src/lib/huawei/rds";
import { getHuaweiVPCInventory } from "../src/lib/huawei/vpc";
import { getHuaweiSubnetInventory } from "../src/lib/huawei/subnet";
import { getHuaweiOBSInventory } from "../src/lib/huawei/obs";
import { getHuaweiELBInventory } from "../src/lib/huawei/elb";
import { getHuaweiCCEInventory } from "../src/lib/huawei/cce";
import { getHuaweiCDNInventory } from "../src/lib/huawei/cdn";
import { getHuaweiDDSInventory } from "../src/lib/huawei/dds";

async function testService(name: string, fn: () => Promise<any[]>) {
  console.log(`\n🔍 Testing ${name}...`);
  try {
    const result = await fn();
    console.log(`✅ ${name}: ${result.length} items found`);
    if (result.length > 0) {
      console.log(`   Sample:`, result[0].name, `(${result[0].service})`);
    }
    return { name, success: true, count: result.length };
  } catch (error: any) {
    console.error(`❌ ${name} FAILED:`, error?.message || error);
    return { name, success: false, error: error?.message || error };
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("🔧 HUAWEI CLOUD SERVICES DIAGNOSTIC");
  console.log("=".repeat(60));

  const accounts = getHuaweiAccounts();
  console.log(`\n📋 Cuentas configuradas: ${accounts.length}`);
  accounts.forEach((acc, i) => {
    console.log(`   ${i + 1}. ${acc.name} (${acc.region})`);
  });

  if (accounts.length === 0) {
    console.error("\n❌ No hay cuentas de Huawei configuradas en .env");
    console.log("\nConfigura las variables:");
    console.log("  HUAWEI_ACCOUNT_1_NAME=...");
    console.log("  HUAWEI_ACCOUNT_1_PROJECT_ID=...");
    console.log("  HUAWEI_ACCOUNT_1_AK=...");
    console.log("  HUAWEI_ACCOUNT_1_SK=...");
    console.log("  HUAWEI_ACCOUNT_1_REGION=la-north-2");
    process.exit(1);
  }

  console.log("\n" + "=".repeat(60));
  console.log("🚀 Testing Services...");
  console.log("=".repeat(60));

  const results = await Promise.all([
    testService("ECS", getHuaweiECSInventory),
    testService("RDS", getHuaweiRDSInventory),
    testService("VPC", getHuaweiVPCInventory),
    testService("Subnet", getHuaweiSubnetInventory),
    testService("OBS", getHuaweiOBSInventory),
    testService("ELB", getHuaweiELBInventory),
    testService("CCE", getHuaweiCCEInventory),
    testService("CDN", getHuaweiCDNInventory),
    testService("DDS", getHuaweiDDSInventory),
  ]);

  console.log("\n" + "=".repeat(60));
  console.log("📊 RESUMEN");
  console.log("=".repeat(60));

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`\n✅ Exitosos: ${successful.length}/${results.length}`);
  successful.forEach((r: any) => {
    console.log(`   - ${r.name}: ${r.count} recursos`);
  });

  if (failed.length > 0) {
    console.log(`\n❌ Fallidos: ${failed.length}/${results.length}`);
    failed.forEach((r: any) => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
  }

  console.log("\n" + "=".repeat(60));
}

main();

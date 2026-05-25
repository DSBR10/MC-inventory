/**
 * Script de diagnóstico para verificar la autenticación de Huawei Cloud
 *
 * Uso:
 *   npx tsx scripts/test-huawei-auth.ts
 */

import { getHuaweiAccounts } from "../src/lib/huawei/accounts";
import { huaweiRequest } from "../src/lib/huawei/auth";

async function testHuaweiAuth() {
  console.log("🔍 Verificando configuración de Huawei Cloud...\n");

  const accounts = getHuaweiAccounts();

  if (accounts.length === 0) {
    console.error("❌ No se encontraron cuentas de Huawei Cloud configuradas");
    console.log(
      "\n📝 Asegúrate de tener las siguientes variables en .env.local:",
    );
    console.log("   HUAWEI_ACCOUNT_1_NAME=mc_inventory");
    console.log("   HUAWEI_ACCOUNT_1_ACCESS_KEY=tu_access_key");
    console.log("   HUAWEI_ACCOUNT_1_SECRET_KEY=tu_secret_key");
    console.log("   HUAWEI_ACCOUNT_1_PROJECT_ID=tu_project_id");
    console.log("   HUAWEI_ACCOUNT_1_REGION=la-north-2");
    process.exit(1);
  }

  console.log(`✅ Encontradas ${accounts.length} cuenta(s) de Huawei Cloud\n`);

  for (const account of accounts) {
    console.log(`📋 Probando cuenta: ${account.name}`);
    console.log(`   Región: ${account.region}`);
    console.log(`   Project ID: ${account.projectId}`);
    console.log(`   Access Key: ${account.accessKey.substring(0, 8)}...`);

    try {
      // Test 1: Listar grupos de logs de LTS
      console.log("\n   🔄 Test 1: Listando grupos de logs (LTS)...");
      const ltsUrl = `https://lts.${account.region}.myhuaweicloud.com/v2/${account.projectId}/groups`;

      const response = await huaweiRequest(
        account,
        "GET",
        ltsUrl,
        "lts",
        account.region,
      );

      if (response.status === 200) {
        console.log("   ✅ Autenticación exitosa con LTS");
        console.log(
          `   📊 Grupos de logs encontrados: ${response.data.log_groups?.length || 0}`,
        );
      } else {
        console.log(`   ⚠️  Respuesta inesperada: ${response.status}`);
      }

      // Test 2: Listar buckets de OBS
      console.log("\n   🔄 Test 2: Listando buckets (OBS)...");
      const obsUrl = `https://obs.${account.region}.myhuaweicloud.com`;

      const obsResponse = await huaweiRequest(
        account,
        "GET",
        obsUrl,
        "obs",
        account.region,
      );

      if (obsResponse.status === 200) {
        console.log("   ✅ Autenticación exitosa con OBS");
      } else {
        console.log(`   ⚠️  Respuesta inesperada: ${obsResponse.status}`);
      }

      console.log("\n   ✅ Todos los tests pasaron para esta cuenta\n");
    } catch (error: any) {
      console.error(`\n   ❌ Error al probar la cuenta ${account.name}:`);

      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(
          `   Mensaje: ${JSON.stringify(error.response.data, null, 2)}`,
        );

        if (error.response.status === 401 || error.response.status === 403) {
          console.log("\n   💡 Posibles soluciones:");
          console.log(
            "      1. Verifica que el Access Key y Secret Key sean correctos",
          );
          console.log(
            "      2. Verifica que el Project ID corresponda a la región correcta",
          );
          console.log(
            "      3. Verifica que el usuario tenga permisos de lectura",
          );
          console.log(
            "      4. Regenera las credenciales en la consola de Huawei Cloud",
          );
        }
      } else if (error.code === "ENOTFOUND") {
        console.error(`   Error de DNS: ${error.message}`);
        console.log("\n   💡 Posibles soluciones:");
        console.log(
          "      1. Verifica que la región sea correcta (la-north-2 para México)",
        );
        console.log("      2. Verifica tu conexión a internet");
      } else {
        console.error(`   ${error.message}`);
      }

      console.log("");
    }
  }

  console.log("🎉 Diagnóstico completado\n");
}

// Ejecutar el test
testHuaweiAuth().catch((error) => {
  console.error("❌ Error fatal:", error);
  process.exit(1);
});

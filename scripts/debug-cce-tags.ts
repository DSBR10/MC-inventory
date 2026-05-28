import dotenv from "dotenv";
import path from "path";

// Cargar variables de .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { huaweiRequest } from "../src/lib/huawei/auth";
import { getHuaweiAccounts } from "../src/lib/huawei/accounts";

async function debugCCETags() {
  const accounts = getHuaweiAccounts();

  if (accounts.length === 0) {
    console.log("❌ No hay cuentas de Huawei configuradas");
    return;
  }

  const account = accounts[0];
  console.log(`🔍 Debuggeando CCE para cuenta: ${account.name}`);
  console.log("");

  try {
    const host = `cce.${account.region}.myhuaweicloud.com`;

    // 1. Obtener la lista de clusters
    const response = await huaweiRequest({
      method: "GET",
      host,
      uri: `/api/v3/projects/${account.projectId}/clusters`,
      ak: account.ak,
      sk: account.sk,
      projectId: account.projectId,
    });

    const clusters = response?.data?.items || [];

    if (clusters.length === 0) {
      console.log("❌ No se encontraron clusters");
      return;
    }

    console.log(`✅ Se encontraron ${clusters.length} cluster(s)\n`);

    for (const cluster of clusters) {
      const clusterId = cluster.metadata?.uid;
      const clusterName = cluster.metadata?.name;

      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📦 CLUSTER: ${clusterName}`);
      console.log(`   ID: ${clusterId}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // 2. Obtener detalles del cluster
      const detailResponse = await huaweiRequest({
        method: "GET",
        host,
        uri: `/api/v3/projects/${account.projectId}/clusters/${clusterId}`,
        ak: account.ak,
        sk: account.sk,
        projectId: account.projectId,
      });

      const clusterDetail = detailResponse?.data || {};

      // Buscar tags en diferentes ubicaciones
      console.log("🔍 Buscando tags en diferentes ubicaciones:\n");

      // Ubicación 1: metadata.labels
      console.log("1️⃣ metadata.labels:");
      if (clusterDetail.metadata?.labels) {
        console.log(JSON.stringify(clusterDetail.metadata.labels, null, 2));
      } else {
        console.log("   ❌ No encontrado");
      }
      console.log("");

      // Ubicación 2: spec.resourceTags
      console.log("2️⃣ spec.resourceTags:");
      if (clusterDetail.spec?.resourceTags) {
        console.log(JSON.stringify(clusterDetail.spec.resourceTags, null, 2));
      } else {
        console.log("   ❌ No encontrado");
      }
      console.log("");

      // Ubicación 3: metadata.annotations
      console.log("3️⃣ metadata.annotations:");
      if (clusterDetail.metadata?.annotations) {
        console.log(
          JSON.stringify(clusterDetail.metadata.annotations, null, 2),
        );
      } else {
        console.log("   ❌ No encontrado");
      }
      console.log("");

      // Ubicación 4: Endpoint de tags específico
      console.log("4️⃣ Endpoint /clusters/{id}/tags:");
      try {
        const tagsResponse = await huaweiRequest({
          method: "GET",
          host,
          uri: `/api/v3/projects/${account.projectId}/clusters/${clusterId}/tags`,
          ak: account.ak,
          sk: account.sk,
          projectId: account.projectId,
        });

        if (tagsResponse?.data) {
          console.log(JSON.stringify(tagsResponse.data, null, 2));
        } else {
          console.log("   ❌ No se obtuvo respuesta");
        }
      } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`);
      }
      console.log("");

      // Mostrar el JSON completo del cluster detail
      console.log("📄 JSON COMPLETO DEL CLUSTER:");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(JSON.stringify(clusterDetail, null, 2));
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
}

debugCCETags();

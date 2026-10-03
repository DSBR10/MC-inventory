import axios from "axios";

import crypto from "crypto";

type HuaweiRequestParams = {

  method: string;

  host: string;

  uri: string;

  ak: string;

  sk: string;

  projectId: string;

  body?: any;

  // Query params firmados (ordenados) para listados paginados (ej. CBR).
  query?: Record<string, string | number | boolean | undefined | null>;

};

export async function getHuaweiToken(): Promise<string> {

  return "";

}

export async function huaweiRequest({

  method,
  host,
  uri,
  ak,
  sk,
  projectId,
  body,
  query

}: HuaweiRequestParams) {

  try {

    const cleanUri =
      uri.endsWith("/")
        ? uri.slice(0, -1)
        : uri;

    const canonicalUri =
      cleanUri + "/";

    // Canonical query string (SDK-HMAC-SHA256): pares ordenados k=v codificados.
    const queryEntries = Object.entries(query || {})
      .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined && entry[1] !== null && entry[1] !== "")
      .map(([k, v]) => [encodeURIComponent(k), encodeURIComponent(String(v))] as const)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

    const canonicalQueryString = queryEntries
      .map(([k, v]) => `${k}=${v}`)
      .join("&");

    const endpoint =
      queryEntries.length > 0
        ? `https://${host}${cleanUri}?${canonicalQueryString}`
        : `https://${host}${cleanUri}`;

    const timestamp =
      new Date()
        .toISOString()
        .replace(/[:-]|\.\d{3}/g, "");

    const signedHeaders =

      "content-type;host;x-project-id;x-sdk-content-sha256;x-sdk-date";

    const canonicalRequest = `${method}
${canonicalUri}
${canonicalQueryString}
content-type:application/json;charset=UTF-8
host:${host}
x-project-id:${projectId}
x-sdk-content-sha256:UNSIGNED-PAYLOAD
x-sdk-date:${timestamp}

${signedHeaders}
UNSIGNED-PAYLOAD`;

    const hashedCanonicalRequest =

      crypto
        .createHash("sha256")
        .update(canonicalRequest)
        .digest("hex");

    const stringToSign = `SDK-HMAC-SHA256
${timestamp}
${hashedCanonicalRequest}`;

    const signature =

      crypto
        .createHmac("sha256", sk)
        .update(stringToSign)
        .digest("hex");

    const authorization =

      `SDK-HMAC-SHA256 Access=${ak}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers = {

      "Content-Type":
        "application/json;charset=UTF-8",

      Host:
        host,

      "X-Project-Id":
        projectId,

      "X-Sdk-Date":
        timestamp,

      "X-Sdk-Content-Sha256":
        "UNSIGNED-PAYLOAD",

      Authorization:
        authorization

    };

    const response =
      await axios({

        method,

        url:
          endpoint,

        headers,

        data:
          body,

        validateStatus:
          () => true

      });

    if (
      response.status >= 400
    ) {

      // Silenciar errores esperados de servicios que pueden no estar
      // disponibles en todas las cuentas/regiones:
      // - 404: recurso no encontrado (siempre silenciado)
      // - 400 de DDS/TMS/RDS: servicio no habilitado en la cuenta
      const isSilenciable =
        response.status === 404 ||
        (response.status === 400 && (
          host?.includes('dds.') ||
          host?.includes('tms.') ||
          host?.includes('rds.')
        ));

      if (
        !isSilenciable
      ) {

        console.error(

          "HUAWEI API ERROR:",

          response.status,

          JSON.stringify(
            response.data,
            null,
            2
          )

        );

      }

    }

    return {

      status:
        response.status,

      data:
        response.data

    };

  } catch (error: any) {

    // Silenciar errores de TMS (Tag Management Service) que no está disponible en algunas regiones
    const isTmsError = host?.includes('tms.');

    if (!isTmsError) {
      console.error(

        "HUAWEI REQUEST ERROR:",

        error?.response?.data || error?.message || error

      );
    }

    return {

      status: 500,

      data: null

    };

  }

}
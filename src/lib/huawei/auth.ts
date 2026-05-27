import axios from "axios";

import crypto from "crypto";

import https from "https";

type HuaweiRequestParams = {

  method: string;

  host: string;

  uri: string;

  ak: string;

  sk: string;

  projectId: string;

  body?: any;

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
  body

}: HuaweiRequestParams) {

  try {

    const cleanUri =
      uri.endsWith("/")
        ? uri.slice(0, -1)
        : uri;

    const canonicalUri =
      cleanUri + "/";

    const endpoint =
      `https://${host}${cleanUri}`;

    const timestamp =
      new Date()
        .toISOString()
        .replace(/[:-]|\.\d{3}/g, "");

    const signedHeaders =

      "content-type;host;x-project-id;x-sdk-content-sha256;x-sdk-date";

    const canonicalRequest = `${method}
${canonicalUri}

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

    const httpsAgent =
      new https.Agent({

        rejectUnauthorized:
          false

      });

    const response =
      await axios({

        method,

        url:
          endpoint,

        headers,

        httpsAgent,

        data:
          body,

        validateStatus:
          () => true

      });

    if (
      response.status >= 400
    ) {

      if (
        response.status !== 404
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

    console.error(

      "HUAWEI REQUEST ERROR:",

      error?.response?.data || error

    );

    return {

      status: 500,

      data: null

    };

  }

}
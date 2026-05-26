import {
  huaweiRequest
} from "./auth";

export async function getHuaweiTags({

  host,
  uri,
  ak,
  sk,
  projectId

}: {

  host: string;

  uri: string;

  ak: string;

  sk: string;

  projectId: string;

}) {

  try {

    const data =
      await huaweiRequest({

        method: "GET",

        host,

        uri,

        ak,

        sk,

        projectId

      });

    if (!data) {

      return {};

    }

    const tags =
      data.tags || [];

    const formatted: Record<string, string> = {};

    for (const tag of tags) {

      if (typeof tag === "string" && tag.includes("=")) {
        // Format: "key=value"
        const [key, ...rest] = tag.split("=");
        formatted[key] = rest.join("=");
      } else if (Array.isArray(tag.values)) {
        formatted[tag.key] =
          tag.values.join(",");
      } else if (tag.key !== undefined) {
        formatted[tag.key] =
          tag.value;
      }

    }

    return formatted;

  } catch (error) {

    console.error(
      "HUAWEI TAG ERROR:",
      error
    );

    return {};

  }

}
import fs from "fs";
import path from "path";

const CACHE_PATH =
  path.join(
    process.cwd(),
    "data",
    "billing-cache.json"
  );

export function readBillingCache() {
  try {
    console.log("READ BILLING CACHE:", CACHE_PATH);
    if (!fs.existsSync(CACHE_PATH)) {
      console.log("BILLING CACHE NOT FOUND");
      return null;
    }
    const raw = fs.readFileSync(CACHE_PATH, "utf-8");
    console.log("BILLING CACHE LOADED");
    return JSON.parse(raw);
  } catch (err) {
    console.error("BILLING CACHE READ ERROR:", err);
    return null;
  }
}

export function writeBillingCache(data: any) {
  try {
    console.log("WRITING BILLING CACHE...");
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(
      CACHE_PATH,
      JSON.stringify(data, null, 2),
      "utf-8"
    );
    console.log("BILLING CACHE WRITTEN");
  } catch (err) {
    console.error("BILLING CACHE WRITE ERROR:", err);
  }
}

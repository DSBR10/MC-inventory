/**
 * Returns yesterday's date in Bogotá timezone as YYYYMMDD string.
 * Used by both AWS and Huawei log backup collectors.
 */
export function getYesterdayBogotaDate(): string {
  const now = new Date();
  const bogotaOffset = -5 * 60;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const bogotaMs = utcMs + bogotaOffset * 60000;
  const bogotaDate = new Date(bogotaMs);
  bogotaDate.setDate(bogotaDate.getDate() - 1);
  const y = bogotaDate.getFullYear();
  const m = String(bogotaDate.getMonth() + 1).padStart(2, "0");
  const d = String(bogotaDate.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

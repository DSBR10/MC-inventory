import * as XLSX from "xlsx";
import { InventoryItem } from "@/types/inventory";

export function exportCSV(
  rows: InventoryItem[],
  filename: string
): void {

  /* ── Datos ── */
  const data = rows.map((r) => ({
    Provider:          r.provider ?? "AWS",
    Account:           r.accountName,
    Service:           r.service,
    Name:              r.name,
    ID:                r.id,
    Host:              r.host,
    "Private IP":      r.privateIp || "N/A",
    "Public IP":       r.publicIp  || "N/A",
    Status:            r.status,
    OS:                r.operatingSystem ?? "N/A",
    VPC:               r.vpcId     || "N/A",
    Subnet:            r.subnetId  || "N/A",
    "Security Groups": (r.securityGroups || []).map(s => s.name).join(" | "),
    Listeners:         (r.listeners     || []).map(l => `${l.protocol}:${l.port}`).join(" | "),
    "Target Groups":   (r.targetGroups  || []).map(t => t.name).join(" | "),
    /* Tags dinámicos */
    ...Object.fromEntries(
      Object.entries(r.tags || {}).map(([k, v]) => [`Tag: ${k}`, v ?? ""])
    ),
  }));

  /* ── Hoja ── */
  const ws = XLSX.utils.json_to_sheet(data);

  /* ── Ancho de columnas automático ── */
  const colWidths = Object.keys(data[0] || {}).map((key) => ({
    wch: Math.max(
      key.length,
      ...data.map(r => String((r as any)[key] || "").length)
    ) + 2,
  }));
  ws["!cols"] = colWidths;

  /* ── Libro ── */
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventory");

  /* ── Descarga ── */
  XLSX.writeFile(wb, filename.replace(/\.csv$/i, ".xlsx"));
}
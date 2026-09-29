import ExcelJS from "exceljs";

import { trackClientAuditEvent } from "@/lib/audit/client";

export type XlsxColumn = {
  key: string;
  header: string;
  width?: number;
  align?: "left" | "right" | "center";
  numFmt?: string;
};

type ExportTableOptions = {
  columns: XlsxColumn[];
  rows: Array<Record<string, string | number | null | undefined>>;
  filename: string;
  sheetName?: string;
  title: string;
  subtitle?: string;
  module: string;
};

const NAVY = "FF14182D";
const NAVY_SOFT = "FF202640";
const WHITE = "FFFFFFFF";
const SOFT = "FFF5F7FB";
const LINE = "FFDCE2EB";
const INK = "FF202437";
const MUTED = "FF697386";

function downloadBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Exportador genérico .xlsx con encabezado corporativo UX Technology.
// REGLA: todo export tipo Excel del sitio debe salir en .xlsx, nunca .csv.
export async function exportTableToXlsx(options: ExportTableOptions): Promise<void> {
  const { columns, rows, filename, title } = options;
  const sheetName = (options.sheetName || "Datos").slice(0, 31);
  const subtitle = options.subtitle || `Generado: ${new Date().toLocaleString("es-CO")}`;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "UX Technology";
  workbook.company = "UX Technology";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName);
  const lastColumn = columns.length;
  sheet.views = [{ showGridLines: false }];
  sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };

  // Banda de marca
  sheet.mergeCells(1, 1, 2, lastColumn);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `UX Technology | ${title}`;
  titleCell.font = { name: "Aptos", size: 14, bold: true, color: { argb: WHITE } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  titleCell.alignment = { vertical: "middle" };
  sheet.getRow(1).height = 26;
  sheet.getRow(2).height = 20;
  const subCell = sheet.getCell(2, 1);
  subCell.value = subtitle;
  subCell.font = { name: "Aptos", size: 9, italic: true, color: { argb: "FFE2E8F0" } };
  subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };

  // Encabezado
  const headerRow = sheet.getRow(4);
  headerRow.values = columns.map((c) => c.header);
  headerRow.height = 24;
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_SOFT } };
    cell.font = { name: "Aptos", size: 9, bold: true, color: { argb: WHITE } };
    cell.alignment = { horizontal: col.align || "left", vertical: "middle", wrapText: true };
    sheet.getColumn(i + 1).width = col.width || 22;
  });

  // Datos
  rows.forEach((record, index) => {
    const row = sheet.getRow(5 + index);
    row.values = columns.map((col) => {
      const v = record[col.key];
      return v === null || v === undefined ? "" : v;
    });
    row.height = 20;
    columns.forEach((col, i) => {
      const cell = row.getCell(i + 1);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: index % 2 === 0 ? WHITE : SOFT } };
      cell.font = { name: "Aptos", size: 10, color: { argb: INK } };
      cell.alignment = { horizontal: col.align || "left", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: LINE } },
        left: { style: "thin", color: { argb: LINE } },
        bottom: { style: "thin", color: { argb: LINE } },
        right: { style: "thin", color: { argb: LINE } },
      };
      if (col.numFmt && typeof cell.value === "number") cell.numFmt = col.numFmt;
    });
  });

  const lastRow = Math.max(rows.length + 4, 4);
  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: lastRow, column: lastColumn } };
  sheet.views = [{ state: "frozen", ySplit: 4, topLeftCell: "A5", showGridLines: false }];

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBuffer(buffer, filename);
  trackClientAuditEvent("export.triggered", {
    category: "export",
    metadata: { module: options.module, format: "xlsx", rowCount: rows.length },
  });
}

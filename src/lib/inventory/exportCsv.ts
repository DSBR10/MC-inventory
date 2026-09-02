import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { InventoryItem } from "@/types/inventory";

const UX_LOGO_PATH = "/branding/ux-technology-logo.png";
const UX_WEBSITE = "https://ux.technology/";

const EXCEL_COLORS = {
  navy: "FF14182D",
  navySoft: "FF202640",
  purple: "FF7439BE",
  magenta: "FFCF39A5",
  cyan: "FF11A8CD",
  ink: "FF202437",
  muted: "FF697386",
  line: "FFDCE2EB",
  soft: "FFF5F7FB",
  white: "FFFFFFFF",
  green: "FF2CBE7A",
  amber: "FFF2B84B",
  red: "FFE35D6A",
};

const ACCOUNT_COLUMNS = ["Cuenta", "Account ID", "Recursos", "Servicios", "En ejecucion", "Proveedores"];
const SERVICE_COLUMNS = ["Provider", "Servicio", "Recursos", "Cuentas", "En ejecucion"];
const INVENTORY_COLUMNS = [
  "Provider",
  "Cuenta",
  "Account ID",
  "Servicio",
  "Tipo de recurso",
  "Nombre",
  "ID",
  "Estado",
  "Host",
  "IP privada",
  "IP publica",
  "Sistema operativo",
  "VPC",
  "Subnet",
  "Zona de disponibilidad",
  "Security Groups",
  "Listeners",
  "Target Groups",
  "Tags",
  "Fecha de lanzamiento",
];

type AccountGroup = {
  name: string;
  id: string;
  rows: InventoryItem[];
};

type SummaryRow = {
  Provider?: string;
  Cuenta?: string;
  "Account ID"?: string;
  Servicio?: string;
  Recursos: number;
  "En ejecucion": number;
  Servicios?: number;
  Cuentas?: number;
  Proveedores?: number;
};

const PDF_COLORS = {
  ink: [20, 24, 45] as [number, number, number],
  purple: [116, 57, 190] as [number, number, number],
  magenta: [207, 57, 165] as [number, number, number],
  cyan: [17, 168, 205] as [number, number, number],
  muted: [100, 108, 125] as [number, number, number],
  line: [222, 226, 235] as [number, number, number],
  soft: [246, 247, 251] as [number, number, number],
};

function buildExportRows(rows: InventoryItem[]) {
  return rows.map((row) => ({
    Provider: row.provider ?? "AWS",
    Cuenta: row.accountName || "N/A",
    "Account ID": row.accountId || "N/A",
    Servicio: row.service || "N/A",
    "Tipo de recurso": row.resourceType || "N/A",
    Nombre: row.name || "N/A",
    ID: row.id || "N/A",
    Estado: row.status || "N/A",
    Host: row.host || "N/A",
    "IP privada": row.privateIp || "N/A",
    "IP publica": row.publicIp || "N/A",
    "Sistema operativo": row.operatingSystem || "N/A",
    VPC: row.vpcId || "N/A",
    Subnet: row.subnetId || "N/A",
    "Zona de disponibilidad": row.availabilityZone || "N/A",
    "Security Groups": (row.securityGroups || []).map((group) => group.name).join(" | "),
    Listeners: (row.listeners || []).map((listener) => `${listener.protocol}:${listener.port}`).join(" | "),
    "Target Groups": (row.targetGroups || []).map((target) => target.name).join(" | "),
    Tags: formatTagSummary(row.tags),
    "Fecha de lanzamiento": row.launchTime || "N/A",
  }));
}

export async function exportInventoryToExcel(
  rows: InventoryItem[],
  filename = "inventory-report.xlsx",
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const generatedAt = new Date();
  const logoData = await loadImageData(UX_LOGO_PATH);
  const logoId = logoData
    ? workbook.addImage({ base64: logoData, extension: "png" })
    : undefined;
  const accountSummary = buildAccountSummary(rows).map((row) => ({
    Cuenta: row.Cuenta ?? "N/A",
    "Account ID": row["Account ID"] ?? "N/A",
    Recursos: row.Recursos ?? 0,
    Servicios: row.Servicios ?? 0,
    "En ejecucion": row["En ejecucion"] ?? 0,
    Proveedores: row.Proveedores ?? 0,
  }));
  const serviceSummary = buildServiceSummary(rows).map((row) => ({
    Provider: row.Provider ?? "N/A",
    Servicio: row.Servicio ?? "N/A",
    Recursos: row.Recursos ?? 0,
    Cuentas: row.Cuentas ?? 0,
    "En ejecucion": row["En ejecucion"] ?? 0,
  }));

  workbook.creator = "UX Technology";
  workbook.lastModifiedBy = "UX Technology";
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
  workbook.company = "UX Technology";
  workbook.title = "MC Inventory | Reporte de inventario cloud";
  workbook.subject = "Reporte corporativo de infraestructura cloud";
  workbook.description = "Inventario filtrado generado desde MC Inventory.";

  createExcelSummarySheet(workbook, logoId, generatedAt, rows, accountSummary, serviceSummary);
  addExcelDataSheet(
    workbook,
    "Por cuenta",
    "UX Technology | Resumen por cuenta",
    "Cada fila consolida una cuenta configurada en MC Inventory.",
    accountSummary,
    ACCOUNT_COLUMNS,
    [24, 20, 13, 13, 16, 16],
    logoId,
    "TableAccountSummary",
  );
  addExcelDataSheet(
    workbook,
    "Por servicio",
    "UX Technology | Resumen por servicio",
    "Consolidado de servicios y proveedores presentes en el inventario.",
    serviceSummary,
    SERVICE_COLUMNS,
    [18, 36, 13, 13, 16],
    logoId,
    "TableServiceSummary",
  );
  addExcelDataSheet(
    workbook,
    "Inventario",
    "UX Technology | Inventario detallado",
    "Detalle filtrado de recursos, red, estado y tags.",
    buildExportRows(rows),
    INVENTORY_COLUMNS,
    [14, 24, 18, 28, 20, 34, 27, 16, 28, 16, 16, 24, 18, 18, 24, 30, 28, 30, 46, 24],
    logoId,
    "TableInventory",
  );

  const buffer = await workbook.xlsx.writeBuffer();
  downloadExcelBuffer(buffer, filename.replace(/\.csv$/i, ".xlsx"));
}

export async function exportInventoryToPDF(
  rows: InventoryItem[],
  filename = "inventory-report.pdf",
): Promise<void> {
  const logoData = await loadImageData(UX_LOGO_PATH);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const generatedAt = new Date().toLocaleString("es-CO");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const accountGroups = buildAccountGroups(rows);
  const accountSummary = buildAccountSummary(rows);
  const serviceSummary = buildServiceSummary(rows);

  drawCover(doc, logoData, rows, generatedAt);

  doc.addPage();
  drawReportHeader(doc, logoData, "Resumen ejecutivo");
  drawSectionTitle(doc, "Resumen por cuenta", "Distribucion de recursos y estado operativo por cuenta.", 78);
  autoTable(doc, {
    startY: 102,
    head: [["Cuenta", "Account ID", "Recursos", "Servicios", "En ejecucion", "Proveedores"]],
    body: accountSummary.map((row) => [
      row.Cuenta ?? "N/A",
      row["Account ID"] ?? "N/A",
      row.Recursos ?? 0,
      row.Servicios ?? 0,
      row["En ejecucion"] ?? 0,
      row.Proveedores ?? 0,
    ]),
    ...summaryTableOptions(logoData),
    columnStyles: { 0: { cellWidth: 190 }, 1: { cellWidth: 120 }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
  });

  let summaryY = getLastTableY(doc, 102) + 26;
  if (summaryY > pageHeight - 150) {
    doc.addPage();
    drawReportHeader(doc, logoData, "Resumen ejecutivo");
    summaryY = 78;
  }
  drawSectionTitle(doc, "Resumen por servicio", "Servicios con mayor presencia en el inventario consolidado.", summaryY);
  autoTable(doc, {
    startY: summaryY + 24,
    head: [["Proveedor", "Servicio", "Recursos", "Cuentas", "En ejecucion"]],
    body: serviceSummary.map((row) => [row.Provider ?? "N/A", row.Servicio ?? "N/A", row.Recursos ?? 0, row.Cuentas ?? 0, row["En ejecucion"] ?? 0]),
    ...summaryTableOptions(logoData),
    columnStyles: { 0: { cellWidth: 130 }, 1: { cellWidth: 250 }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
  });

  doc.addPage();
  drawReportHeader(doc, logoData, "Detalle por cuenta y servicio");
  let cursor = 78;

  for (const account of accountGroups) {
    if (cursor > pageHeight - 150) {
      doc.addPage();
      drawReportHeader(doc, logoData, "Detalle por cuenta y servicio");
      cursor = 78;
    }

    doc.setFillColor(...PDF_COLORS.soft);
    doc.roundedRect(36, cursor, pageWidth - 72, 38, 7, 7, "F");
    doc.setFontSize(12);
    doc.setTextColor(...PDF_COLORS.ink);
    doc.setFont("helvetica", "bold");
    doc.text(account.name, 48, cursor + 17);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(`Account ID: ${account.id} | ${account.rows.length} recursos`, 48, cursor + 30);

    const accountServices = buildServiceSummary(account.rows);
    autoTable(doc, {
      startY: cursor + 50,
      head: [["Servicio", "Proveedor", "Recursos", "En ejecucion"]],
      body: accountServices.map((row) => [row.Servicio ?? "N/A", row.Provider ?? "N/A", row.Recursos ?? 0, row["En ejecucion"] ?? 0]),
      ...summaryTableOptions(logoData),
      columnStyles: { 0: { cellWidth: 260 }, 1: { cellWidth: 130 }, 2: { halign: "right" }, 3: { halign: "right" } },
    });

    cursor = getLastTableY(doc, cursor + 50) + 14;
    autoTable(doc, {
      startY: cursor,
      head: [["Servicio", "Recurso", "ID", "Estado", "Zona / Host", "IP privada", "Tags"]],
      body: [...account.rows]
        .sort((a, b) => a.service.localeCompare(b.service) || a.name.localeCompare(b.name))
        .map((row) => [
          row.service,
          row.name,
          row.id,
          row.status,
          row.availabilityZone || row.host || "N/A",
          row.privateIp || "N/A",
          formatTagSummary(row.tags),
        ]),
      ...detailTableOptions(logoData),
      columnStyles: { 0: { cellWidth: 92 }, 1: { cellWidth: 150 }, 2: { cellWidth: 120 }, 3: { cellWidth: 65 }, 4: { cellWidth: 110 }, 5: { cellWidth: 85 }, 6: { cellWidth: 130 } },
    });
    cursor = getLastTableY(doc, cursor) + 22;
  }

  if (accountGroups.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text("No hay recursos para mostrar con los filtros actuales.", 36, cursor);
  }

  drawFooters(doc);
  doc.save(filename.replace(/\.xlsx$/i, ".pdf"));
}

type ExcelRecord = Record<string, string | number>;

function createExcelSummarySheet(
  workbook: ExcelJS.Workbook,
  logoId: number | undefined,
  generatedAt: Date,
  rows: InventoryItem[],
  accountSummary: ExcelRecord[],
  serviceSummary: ExcelRecord[],
) {
  const sheet = workbook.addWorksheet("Resumen");
  const lastColumn = 8;
  setupExcelSheet(sheet, lastColumn, EXCEL_COLORS.cyan);
  [26, 22, 18, 18, 18, 18, 18, 18].forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  addExcelBranding(
    sheet,
    logoId,
    "MC Inventory | Reporte corporativo de inventario cloud",
    "Resumen ejecutivo del inventario filtrado",
    generatedAt,
    lastColumn,
  );

  const providers = [...new Set(rows.map((row) => row.provider || "AWS"))].sort();
  const metrics = [
    ["RECURSOS", rows.length, "Inventario filtrado", EXCEL_COLORS.cyan],
    ["CUENTAS", accountSummary.length, "Cuentas consolidadas", EXCEL_COLORS.purple],
    ["SERVICIOS", serviceSummary.length, "Servicios detectados", EXCEL_COLORS.magenta],
    ["OPERATIVOS", rows.filter((row) => isRunning(row.status)).length, "Estado operativo", EXCEL_COLORS.green],
  ] as const;

  metrics.forEach(([label, value, detail, color], index) => {
    const startColumn = 1 + index * 2;
    styleExcelRange(sheet, 6, startColumn, 9, startColumn + 1, {
      fill: EXCEL_COLORS.white,
      border: EXCEL_COLORS.line,
    });
    sheet.mergeCells(6, startColumn, 6, startColumn + 1);
    sheet.mergeCells(7, startColumn, 8, startColumn + 1);
    sheet.mergeCells(9, startColumn, 9, startColumn + 1);
    const labelCell = sheet.getCell(6, startColumn);
    labelCell.value = label;
    labelCell.fill = solidExcelFill(color);
    labelCell.font = { name: "Aptos", size: 9, bold: true, color: excelColor(EXCEL_COLORS.white) };
    labelCell.alignment = { horizontal: "center", vertical: "middle" };
    const valueCell = sheet.getCell(7, startColumn);
    valueCell.value = value;
    valueCell.font = { name: "Aptos Display", size: 24, bold: true, color: excelColor(EXCEL_COLORS.navy) };
    valueCell.alignment = { horizontal: "center", vertical: "middle" };
    valueCell.numFmt = "#,##0";
    const detailCell = sheet.getCell(9, startColumn);
    detailCell.value = detail;
    detailCell.fill = solidExcelFill(EXCEL_COLORS.soft);
    detailCell.font = { name: "Aptos", size: 9, color: excelColor(EXCEL_COLORS.muted) };
    detailCell.alignment = { horizontal: "center", vertical: "middle" };
  });
  [6, 7, 8, 9].forEach((rowNumber) => {
    sheet.getRow(rowNumber).height = rowNumber === 7 || rowNumber === 8 ? 27 : 22;
  });

  mergeExcelSection(sheet, 11, lastColumn, "NAVEGACION DEL REPORTE");
  styleExcelHeaderRow(sheet, 12, ["Hoja", "Contenido", "Registros"]);
  const navigation = [
    ["Por cuenta", "Consolidado de recursos, servicios y estado por cuenta", accountSummary.length, "#'Por cuenta'!A1"],
    ["Por servicio", "Consolidado por proveedor y servicio", serviceSummary.length, "#'Por servicio'!A1"],
    ["Inventario", "Detalle completo del inventario filtrado", rows.length, "#Inventario!A1"],
  ] as const;
  navigation.forEach(([name, description, count, hyperlink], index) => {
    const row = sheet.getRow(13 + index);
    row.values = [name, description, count];
    row.getCell(1).value = { text: name, hyperlink };
    row.getCell(1).font = { name: "Aptos", size: 10, bold: true, color: excelColor(EXCEL_COLORS.purple), underline: "single" };
    styleExcelDataRow(row, ["Hoja", "Contenido", "Registros"], index);
    row.getCell(3).numFmt = "#,##0";
  });

  mergeExcelSection(sheet, 18, lastColumn, "DISTRIBUCION POR PROVEEDOR");
  styleExcelHeaderRow(sheet, 19, ["Proveedor", "Recursos", "Participacion"]);
  providers.forEach((provider, index) => {
    const count = rows.filter((row) => (row.provider || "AWS") === provider).length;
    const row = sheet.getRow(20 + index);
    row.values = [provider, count, rows.length > 0 ? count / rows.length : 0];
    styleExcelDataRow(row, ["Proveedor", "Recursos", "Participacion"], index);
    row.getCell(2).numFmt = "#,##0";
    row.getCell(3).numFmt = "0.0%";
  });

  const websiteRow = 21 + providers.length;
  sheet.getCell(websiteRow, 1).value = "Sitio web";
  sheet.getCell(websiteRow, 2).value = { text: UX_WEBSITE, hyperlink: UX_WEBSITE };
  styleExcelRange(sheet, websiteRow, 1, websiteRow, 2, { fill: EXCEL_COLORS.soft, border: EXCEL_COLORS.line });
  sheet.getCell(websiteRow, 2).font = { name: "Aptos", size: 10, color: excelColor(EXCEL_COLORS.purple), underline: "single" };
  sheet.pageSetup.printArea = `A1:H${websiteRow}`;
}

function addExcelDataSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  title: string,
  subtitle: string,
  rows: ExcelRecord[],
  columns: string[],
  widths: number[],
  logoId: number | undefined,
  tabColor: string,
) {
  const sheet = workbook.addWorksheet(name);
  const lastColumn = columns.length;
  setupExcelSheet(sheet, lastColumn, tabColor);
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  addExcelBranding(sheet, logoId, title, subtitle, new Date(), lastColumn);
  styleExcelHeaderRow(sheet, 5, columns);

  rows.forEach((record, index) => {
    const row = sheet.getRow(6 + index);
    row.values = columns.map((column) => record[column] ?? "");
    styleExcelDataRow(row, columns, index);
  });

  const lastRow = Math.max(rows.length + 5, 5);
  sheet.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: lastRow, column: lastColumn },
  };
  sheet.views = [{ state: "frozen", ySplit: 5, topLeftCell: "A6", showGridLines: false }];
  sheet.pageSetup.printArea = `A1:${excelColumnName(lastColumn)}${lastRow}`;
}

function setupExcelSheet(sheet: ExcelJS.Worksheet, lastColumn: number, tabColor: string) {
  sheet.properties.defaultRowHeight = 20;
  sheet.views = [{ showGridLines: false }];
  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
  };
  sheet.pageSetup.margins = { left: 0.25, right: 0.25, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 };
  sheet.headerFooter = {
    oddFooter: `&LUX Technology | MC Inventory&C&"Aptos,Regular"Pagina &P de &N`,
  };
  sheet.properties.tabColor = { argb: tabColor };
  for (let column = 1; column <= lastColumn; column += 1) {
    sheet.getColumn(column).alignment = { vertical: "middle" };
  }
}

function addExcelBranding(
  sheet: ExcelJS.Worksheet,
  logoId: number | undefined,
  title: string,
  subtitle: string,
  generatedAt: Date,
  lastColumn: number,
) {
  const titleColumn = logoId ? 3 : 1;
  styleExcelRange(sheet, 1, 1, 3, lastColumn, { fill: EXCEL_COLORS.navy, border: EXCEL_COLORS.navy });
  if (logoId) {
    sheet.addImage(logoId, { tl: { col: 0.18, row: 0.18 }, ext: { width: 136, height: 73 } });
  }
  sheet.mergeCells(1, titleColumn, 2, lastColumn);
  sheet.mergeCells(3, titleColumn, 3, lastColumn);
  const titleCell = sheet.getCell(1, titleColumn);
  titleCell.value = title;
  titleCell.font = { name: "Aptos Display", size: 17, bold: true, color: excelColor(EXCEL_COLORS.white) };
  titleCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  const subtitleCell = sheet.getCell(3, titleColumn);
  subtitleCell.value = subtitle;
  subtitleCell.font = { name: "Aptos", size: 10, color: excelColor("FFE2E8F0") };
  subtitleCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 28;
  sheet.getRow(2).height = 28;
  sheet.getRow(3).height = 22;
  const generatedCell = sheet.getCell(4, titleColumn);
  generatedCell.value = `Generado: ${generatedAt.toLocaleString("es-CO")}`;
  generatedCell.font = { name: "Aptos", size: 9, italic: true, color: excelColor(EXCEL_COLORS.muted) };
  generatedCell.alignment = { vertical: "middle" };
  const websiteCell = sheet.getCell(4, lastColumn);
  websiteCell.value = { text: "ux.technology", hyperlink: UX_WEBSITE };
  websiteCell.font = { name: "Aptos", size: 9, color: excelColor(EXCEL_COLORS.purple), underline: "single" };
  websiteCell.alignment = { horizontal: "right", vertical: "middle" };
  sheet.getRow(4).height = 20;
}

function styleExcelHeaderRow(sheet: ExcelJS.Worksheet, rowNumber: number, columns: string[]) {
  const row = sheet.getRow(rowNumber);
  row.values = columns;
  row.height = 28;
  columns.forEach((column, index) => {
    const cell = row.getCell(index + 1);
    cell.fill = solidExcelFill(EXCEL_COLORS.navySoft);
    cell.font = { name: "Aptos", size: 9, bold: true, color: excelColor(EXCEL_COLORS.white) };
    cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    cell.border = excelBorder(EXCEL_COLORS.navySoft);
    if (["Recursos", "Servicios", "Cuentas", "En ejecucion", "Proveedores", "Registros", "Participacion"].includes(column)) {
      cell.alignment = { horizontal: "right", vertical: "middle", wrapText: true };
    }
  });
}

function styleExcelDataRow(row: ExcelJS.Row, columns: string[], index: number) {
  row.height = columns.includes("Tags") || columns.includes("Contenido") ? 34 : 22;
  columns.forEach((column, columnIndex) => {
    const cell = row.getCell(columnIndex + 1);
    cell.fill = solidExcelFill(index % 2 === 0 ? EXCEL_COLORS.white : EXCEL_COLORS.soft);
    cell.font = { name: "Aptos", size: 10, color: excelColor(EXCEL_COLORS.ink) };
    cell.border = excelBorder(EXCEL_COLORS.line);
    cell.alignment = {
      horizontal: ["Recursos", "Servicios", "Cuentas", "En ejecucion", "Proveedores", "Registros", "Participacion"].includes(column) ? "right" : "left",
      vertical: "middle",
      wrapText: ["Tags", "Contenido", "Descripcion", "Security Groups", "Listeners", "Target Groups"].includes(column),
    };
    if (typeof cell.value === "number") cell.numFmt = "#,##0";
    if (column === "Estado") styleExcelStatus(cell);
  });
}

function styleExcelStatus(cell: ExcelJS.Cell) {
  const status = String(cell.value || "").toLowerCase();
  if (["running", "available", "active", "ok", "in-use", "associated"].includes(status)) {
    cell.font = { name: "Aptos", size: 10, bold: true, color: excelColor(EXCEL_COLORS.green) };
  } else if (status && status !== "n/a") {
    cell.font = { name: "Aptos", size: 10, bold: true, color: excelColor(EXCEL_COLORS.amber) };
  }
}

function styleExcelRange(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  startColumn: number,
  endRow: number,
  endColumn: number,
  style: { fill: string; border: string },
) {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let column = startColumn; column <= endColumn; column += 1) {
      const cell = sheet.getCell(row, column);
      cell.fill = solidExcelFill(style.fill);
      cell.border = excelBorder(style.border);
    }
  }
}

function mergeExcelSection(sheet: ExcelJS.Worksheet, rowNumber: number, lastColumn: number, label: string) {
  sheet.mergeCells(rowNumber, 1, rowNumber, lastColumn);
  const cell = sheet.getCell(rowNumber, 1);
  cell.value = label;
  cell.fill = solidExcelFill(EXCEL_COLORS.navySoft);
  cell.font = { name: "Aptos", size: 10, bold: true, color: excelColor(EXCEL_COLORS.white) };
  cell.alignment = { horizontal: "left", vertical: "middle" };
  sheet.getRow(rowNumber).height = 24;
}

function solidExcelFill(argb: string) {
  return { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } };
}

function excelColor(argb: string) {
  return { argb };
}

function excelBorder(argb: string) {
  return {
    top: { style: "thin" as const, color: { argb } },
    left: { style: "thin" as const, color: { argb } },
    bottom: { style: "thin" as const, color: { argb } },
    right: { style: "thin" as const, color: { argb } },
  };
}

function excelColumnName(index: number) {
  let result = "";
  let current = index;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

function downloadExcelBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function buildAccountGroups(rows: InventoryItem[]): AccountGroup[] {
  const groups = new Map<string, AccountGroup>();
  for (const row of rows) {
    const key = `${row.accountId}::${row.accountName}`;
    const group = groups.get(key) || { name: row.accountName, id: row.accountId, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function buildAccountSummary(rows: InventoryItem[]): SummaryRow[] {
  return buildAccountGroups(rows).map((account) => ({
    Cuenta: account.name,
    "Account ID": account.id,
    Recursos: account.rows.length,
    Servicios: new Set(account.rows.map((row) => row.service)).size,
    "En ejecucion": account.rows.filter((row) => isRunning(row.status)).length,
    Proveedores: new Set(account.rows.map((row) => row.provider || "AWS")).size,
  }));
}

function buildServiceSummary(rows: InventoryItem[]): SummaryRow[] {
  const grouped = new Map<string, { provider: string; service: string; rows: InventoryItem[] }>();
  for (const row of rows) {
    const provider = row.provider || "AWS";
    const key = `${provider}::${row.service}`;
    const group = grouped.get(key) || { provider, service: row.service, rows: [] };
    group.rows.push(row);
    grouped.set(key, group);
  }

  return [...grouped.values()]
    .sort((a, b) => b.rows.length - a.rows.length || a.service.localeCompare(b.service))
    .map((group) => ({
      Provider: group.provider,
      Servicio: group.service,
      Recursos: group.rows.length,
      Cuentas: new Set(group.rows.map((row) => row.accountId)).size,
      "En ejecucion": group.rows.filter((row) => isRunning(row.status)).length,
    }));
}

function isRunning(status: string) {
  return ["running", "available", "active", "ok", "in-use", "associated"].includes(status.toLowerCase());
}

function formatTagSummary(tags?: Record<string, string>) {
  return Object.entries(tags || {})
    .filter(([, value]) => value && value !== "Sin tag")
    .slice(0, 5)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" | ") || "Sin tags";
}

function appendText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number) {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  doc.text(lines, x, y);
  return lines.length;
}

function drawCover(doc: jsPDF, logoData: string | null, rows: InventoryItem[], generatedAt: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const accountSummary = buildAccountSummary(rows);
  const serviceSummary = buildServiceSummary(rows);

  doc.setFillColor(250, 250, 253);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  drawBrandBand(doc, 132);
  drawLogo(doc, logoData, 44, 28, 126, 67, true);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("REPORTE CORPORATIVO", pageWidth - 44, 51, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240);
  doc.text("UX Technology", pageWidth - 44, 67, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.ink);
  doc.setFontSize(28);
  doc.text("Reporte de inventario cloud", 44, 188);
  doc.setFontSize(15);
  doc.setTextColor(...PDF_COLORS.purple);
  doc.text("MC Inventory", 44, 216);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...PDF_COLORS.muted);
  appendText(doc, "Reporte corporativo de infraestructura, recursos y estado operativo preparado para UX Technology.", 44, 246, 440);

  doc.setDrawColor(...PDF_COLORS.line);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(44, 300, pageWidth - 88, 92, 10, 10, "FD");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text("DOCUMENTO", 64, 327);
  doc.text("GENERADO", 275, 327);
  doc.text("COBERTURA", 490, 327);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...PDF_COLORS.ink);
  doc.text("Inventario consolidado", 64, 350);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(generatedAt, 275, 350);
  doc.text(`${accountSummary.length} cuentas | ${serviceSummary.length} servicios`, 490, 350);

  const metrics = [
    ["RECURSOS", rows.length.toLocaleString("es-CO"), PDF_COLORS.purple],
    ["CUENTAS", accountSummary.length.toLocaleString("es-CO"), PDF_COLORS.cyan],
    ["SERVICIOS", serviceSummary.length.toLocaleString("es-CO"), PDF_COLORS.magenta],
    ["OPERATIVOS", rows.filter((row) => isRunning(row.status)).length.toLocaleString("es-CO"), [36, 166, 126] as [number, number, number]],
  ] as const;
  const gap = 12;
  const cardWidth = (pageWidth - 88 - gap * 3) / 4;
  metrics.forEach(([label, value, color], index) => {
    const x = 44 + index * (cardWidth + gap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...PDF_COLORS.line);
    doc.roundedRect(x, 430, cardWidth, 76, 9, 9, "FD");
    doc.setFillColor(...color);
    doc.roundedRect(x, 430, 5, 76, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(label, x + 18, 452);
    doc.setFontSize(24);
    doc.setTextColor(...PDF_COLORS.ink);
    doc.text(value, x + 18, 483);
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text("UX Technology | MC Inventory", 44, pageHeight - 42);
  doc.text("Documento de uso corporativo", pageWidth - 184, pageHeight - 42);
}

function drawReportHeader(doc: jsPDF, logoData: string | null, section: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  drawBrandBand(doc, 64);
  drawLogo(doc, logoData, 36, 10, 84, 45, true);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("MC Inventory", 136, 27);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240);
  doc.text("UX Technology", 136, 41);
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(section, pageWidth - 36, 35, { align: "right" });
}

function drawBrandBand(doc: jsPDF, height: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...PDF_COLORS.ink);
  doc.rect(0, 0, pageWidth, height, "F");
  doc.setFillColor(...PDF_COLORS.purple);
  doc.rect(0, 0, pageWidth * 0.63, 6, "F");
  doc.setFillColor(...PDF_COLORS.magenta);
  doc.rect(pageWidth * 0.63, 0, pageWidth * 0.37, 6, "F");
}

function drawSectionTitle(doc: jsPDF, title: string, subtitle: string, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...PDF_COLORS.ink);
  doc.text(title, 36, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text(subtitle, 36, y + 16);
}

function drawLogo(doc: jsPDF, logoData: string | null, x: number, y: number, width: number, height: number, onDark = false) {
  if (logoData) {
    doc.addImage(logoData, "PNG", x, y, width, height, undefined, "MEDIUM");
    return;
  }

  doc.setFillColor(...PDF_COLORS.purple);
  doc.roundedRect(x, y, Math.min(height, 42), Math.min(height, 42), 8, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(Math.min(height * 0.42, 18));
  doc.setTextColor(255, 255, 255);
  doc.text("UX", x + 8, y + Math.min(height, 42) * 0.66);
  doc.setFontSize(9);
  const fallbackTextColor = onDark ? ([255, 255, 255] as [number, number, number]) : PDF_COLORS.ink;
  doc.setTextColor(...fallbackTextColor);
  doc.text("UX Technology", x + Math.min(height, 42) + 10, y + 25);
}

function summaryTableOptions(logoData: string | null) {
  return {
    theme: "grid" as const,
    styles: { fontSize: 8, cellPadding: 5, textColor: PDF_COLORS.ink, lineColor: PDF_COLORS.line, lineWidth: 0.4 },
    headStyles: { fillColor: PDF_COLORS.ink, textColor: [255, 255, 255] as [number, number, number], fontStyle: "bold" as const },
    alternateRowStyles: { fillColor: PDF_COLORS.soft },
    margin: { top: 72, right: 36, bottom: 38, left: 36 },
    didDrawPage: ({ doc: currentDoc }: { doc: jsPDF }) => drawReportHeader(currentDoc, logoData, "Resumen ejecutivo"),
  };
}

function detailTableOptions(logoData: string | null) {
  return {
    theme: "grid" as const,
    styles: { fontSize: 7, cellPadding: 4, textColor: PDF_COLORS.ink, lineColor: PDF_COLORS.line, lineWidth: 0.35, overflow: "linebreak" as const },
    headStyles: { fillColor: PDF_COLORS.purple, textColor: [255, 255, 255] as [number, number, number], fontStyle: "bold" as const },
    alternateRowStyles: { fillColor: [252, 252, 254] as [number, number, number] },
    margin: { top: 72, right: 36, bottom: 38, left: 36 },
    didDrawPage: ({ doc: currentDoc }: { doc: jsPDF }) => drawReportHeader(currentDoc, logoData, "Detalle por cuenta y servicio"),
  };
}

function drawFooters(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pages = doc.getNumberOfPages();
  for (let page = 2; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(...PDF_COLORS.line);
    doc.line(36, pageHeight - 28, pageWidth - 36, pageHeight - 28);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text("UX Technology | MC Inventory", 36, pageHeight - 14);
    doc.text(`Pagina ${page - 1} de ${pages - 1}`, pageWidth - 36, pageHeight - 14, { align: "right" });
  }
}

function getLastTableY(doc: jsPDF, fallback: number) {
  const table = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  return table?.finalY || fallback;
}

async function loadImageData(path: string): Promise<string | null> {
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Invalid image"));
      reader.onerror = () => reject(reader.error || new Error("Unable to read image"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

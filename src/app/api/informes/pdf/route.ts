import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/server";
import { generateInformeData, generateEmailHtml, filterInformeData } from "@/lib/email/informe";
import { generateRdsInformeData, generateRdsEmailHtml, filterRdsInformeData } from "@/lib/email/informe-rds";
import { generateLogsInformeData, generateLogsEmailHtml, filterLogsInformeData } from "@/lib/email/informe-logs";

export async function GET(request: Request) {
  const guard = await requireApiSession("inventory:view", request);
  if (guard.response) return guard.response;

  const params = new URL(request.url).searchParams;
  const reportType = params.get("reportType");
  const provider = params.get("provider");

  let html: string;
  if (reportType === "rds") {
    const full = await generateRdsInformeData();
    const data = provider === "AWS" || provider === "HUAWEI CLOUD" ? filterRdsInformeData(full, provider) : full;
    html = generateRdsEmailHtml(data);
  } else if (reportType === "logs") {
    const full = await generateLogsInformeData();
    const data = provider === "AWS" || provider === "HUAWEI CLOUD" ? filterLogsInformeData(full, provider) : full;
    html = generateLogsEmailHtml(data);
  } else {
    const full = await generateInformeData();
    const data = provider === "AWS" || provider === "HUAWEI CLOUD" ? filterInformeData(full, provider) : full;
    html = generateEmailHtml(data);
  }

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

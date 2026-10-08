import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/server";
import { generateInformeData } from "@/lib/email/informe";
import { generateRdsInformeData } from "@/lib/email/informe-rds";
import { generateLogsInformeData } from "@/lib/email/informe-logs";
import { isSendGridConfigured } from "@/lib/email/sendgrid";

export async function GET(request: Request) {
  const guard = await requireApiSession("inventory:view", request);
  if (guard.response) return guard.response;

  const [servers, rds, logs, sendGridConfigured] = await Promise.all([
    generateInformeData(),
    generateRdsInformeData(),
    generateLogsInformeData(),
    isSendGridConfigured(),
  ]);

  return NextResponse.json({
    servers,
    rds,
    logs,
    sendGridConfigured,
  });
}

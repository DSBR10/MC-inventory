import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/server";
import { generateInformeData } from "@/lib/email/informe";
import { isSendGridConfigured } from "@/lib/email/sendgrid";

export async function GET(request: Request) {
  const guard = await requireApiSession("inventory:view", request);
  if (guard.response) return guard.response;

  const data = await generateInformeData();

  return NextResponse.json({
    ...data,
    sendGridConfigured: isSendGridConfigured(),
  });
}

import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/server";
import { generateInformeData, generateEmailHtml } from "@/lib/email/informe";

export async function GET(request: Request) {
  const guard = await requireApiSession("inventory:view", request);
  if (guard.response) return guard.response;

  const data = await generateInformeData();
  const html = generateEmailHtml(data);

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

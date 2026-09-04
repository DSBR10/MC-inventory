import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";

import AuditDetailPage from "@/components/audit/AuditDetailPage";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/roles";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function AuditDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasPermission(session.user.role, "audit:view")) redirect("/");

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  return <AuditDetailPage id={id} />;
}

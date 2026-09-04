import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import AuditDashboard from "@/components/audit/AuditDashboard";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/roles";

export default async function AuditPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasPermission(session.user.role, "audit:view")) redirect("/");
  return <AuditDashboard />;
}

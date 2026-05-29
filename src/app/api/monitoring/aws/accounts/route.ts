import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/server";
import { getAWSAccounts } from "@/lib/aws/aws-accounts";

export async function GET(request: NextRequest) {
  try {
    const guard = await requireApiSession("monitoring:view");
    if (guard.response) return guard.response;

    const accounts = getAWSAccounts();

    // Return only safe information (without credentials)
    const safeAccounts = accounts.map((acc) => ({
      name: acc.name,
      id: acc.id,
      region: acc.region,
    }));

    return NextResponse.json({
      success: true,
      accounts: safeAccounts,
    });
  } catch (error) {
    console.error("Error fetching AWS accounts:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch AWS accounts" },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getRDSMetrics } from "@/lib/aws/cloudwatch-metrics";
import {
  getAWSAccountByNameOrId,
  getDefaultAWSAccount,
} from "@/lib/aws/aws-accounts";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dbInstanceIds = searchParams.get("dbInstanceIds")?.split(",") || [];
    const accountNameOrId = searchParams.get("account");

    if (dbInstanceIds.length === 0) {
      return NextResponse.json(
        { error: "dbInstanceIds parameter is required" },
        { status: 400 },
      );
    }

    // Get AWS account credentials
    let account;
    if (accountNameOrId) {
      account = getAWSAccountByNameOrId(accountNameOrId);
      if (!account) {
        return NextResponse.json(
          { error: "AWS account not found" },
          { status: 404 },
        );
      }
    } else {
      account = getDefaultAWSAccount();
      if (!account) {
        return NextResponse.json(
          { error: "No AWS accounts configured" },
          { status: 500 },
        );
      }
    }

    const metrics = await getRDSMetrics(account, dbInstanceIds);

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error("Error fetching RDS metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch RDS metrics" },
      { status: 500 },
    );
  }
}

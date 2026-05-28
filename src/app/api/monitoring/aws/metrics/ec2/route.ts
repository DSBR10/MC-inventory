import { NextRequest, NextResponse } from "next/server";
import { getEC2Metrics } from "@/lib/aws/cloudwatch-metrics";
import {
  getAWSAccountByNameOrId,
  getDefaultAWSAccount,
} from "@/lib/aws/aws-accounts";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const instanceIds = searchParams.get("instanceIds")?.split(",") || [];
    const accountNameOrId = searchParams.get("account");

    if (instanceIds.length === 0) {
      return NextResponse.json(
        { error: "instanceIds parameter is required" },
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

    const metrics = await getEC2Metrics(account, instanceIds);

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error("Error fetching EC2 metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch EC2 metrics" },
      { status: 500 },
    );
  }
}

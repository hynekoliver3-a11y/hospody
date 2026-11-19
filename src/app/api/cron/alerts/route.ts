import { NextResponse, type NextRequest } from "next/server";
import { runAlerts } from "@/lib/alerts/run";

// Vercel Cron volá GET s hlavičkou Authorization: Bearer $CRON_SECRET.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dryRun = request.nextUrl.searchParams.get("dry") === "1";
  try {
    const result = await runAlerts(new Date(), { dryRun });
    return NextResponse.json(result, { status: result.errors.length ? 207 : 200 });
  } catch (e) {
    console.error("cron alerts failed", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

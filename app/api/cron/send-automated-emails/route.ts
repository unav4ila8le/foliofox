import { NextResponse, connection } from "next/server";
import { headers } from "next/headers";

import { runAutomatedEmailCron } from "@/server/automated-emails/run";

export async function GET() {
  // Wait for the incoming request so this route is never prerendered.
  await connection();

  try {
    const cronSecret = process.env.CRON_SECRET?.trim();
    if (!cronSecret) {
      console.error(
        "CRON_SECRET is not configured for the automated email cron route",
      );

      return new Response("Server misconfigured", {
        status: 500,
      });
    }

    const authHeader = (await headers()).get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", {
        status: 401,
      });
    }

    console.log("Starting automated email cron job...");

    const result = await runAutomatedEmailCron();

    console.log("Automated email cron job finished:", result.stats);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Automated email cron job failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

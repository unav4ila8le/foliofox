import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/supabase/middleware";

export async function proxy(request: NextRequest) {
  const maintenanceEnabled = process.env.MAINTENANCE_MODE === "true";

  // If maintenance is enabled, redirect to the maintenance page
  if (maintenanceEnabled) {
    const url = request.nextUrl.clone();
    url.pathname = "/maintenance";
    return NextResponse.rewrite(url, { status: 503 });
  }

  // Normal flow: attach Supabase session
  return await updateSession(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/update-password"],
};

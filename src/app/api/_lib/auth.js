import { NextResponse } from "next/server";
import { isLocalRequest } from "@/dashboardGuard";

/**
 * Wrap a Next.js route handler with localhost-only auth.
 * Defense-in-depth: middleware already gates these paths,
 * but react-doctor wants explicit handler-level checks.
 */
export function withLocalAuth(handler) {
  return async (request, ctx) => {
    if (!isLocalRequest(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handler(request, ctx);
  };
}

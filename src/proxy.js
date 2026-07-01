import { NextResponse } from "next/server";
import { proxy as dashboardProxy } from "./dashboardGuard";

export default async function proxy(request) {
  const { pathname } = request.nextUrl;
  if (
    pathname === "/dashboard/media-providers/webSearch" ||
    pathname === "/dashboard/media-providers/webFetch"
  ) {
    return NextResponse.redirect(new URL("/dashboard/media-providers/web", request.url));
  }
  return dashboardProxy(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};

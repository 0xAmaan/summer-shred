import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Two-tier auth:
//   SITE_PASSWORD  → cookie "site_token" → unlocks the public dashboard
//   ADMIN_PASSWORD    → cookie "auth_token" → unlocks /admin (implies site access)
//
// Both env vars are optional. If SITE_PASSWORD is unset, the public site is
// open. If ADMIN_PASSWORD is unset, /admin is unreachable (no one has the
// password to set the cookie). The login page accepts either.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that must always work so users can log in, plus PWA
  // assets that the OS fetches before the user is logged in.
  if (
    pathname.startsWith("/api/auth") ||
    pathname === "/login" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/icon.svg" ||
    pathname === "/apple-icon.svg"
  ) {
    return NextResponse.next();
  }

  const sitePass = process.env.SITE_PASSWORD;
  const adminPass = process.env.ADMIN_PASSWORD;
  const siteToken = request.cookies.get("site_token")?.value;
  const authToken = request.cookies.get("auth_token")?.value;

  const hasAdmin = Boolean(adminPass) && authToken === adminPass;
  // Holding the admin token implies site access.
  const hasSite =
    !sitePass || siteToken === sitePass || hasAdmin;

  if (pathname.startsWith("/admin")) {
    if (!hasAdmin) return redirectToLogin(request, pathname);
    return NextResponse.next();
  }

  if (!hasSite) return redirectToLogin(request, pathname);
  return NextResponse.next();
}

function redirectToLogin(request: NextRequest, next: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

// Match every route except static assets and Next internals.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)",
  ],
};

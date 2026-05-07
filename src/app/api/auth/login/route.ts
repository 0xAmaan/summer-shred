import { NextResponse } from "next/server";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days
};

export async function POST(request: Request) {
  const { password } = await request.json();
  const sitePass = process.env.SITE_PASSWORD;
  const adminPass = process.env.ADMIN_PASSWORD;

  // Admin password unlocks both tiers.
  if (adminPass && password === adminPass) {
    const response = NextResponse.json({ success: true, role: "admin" });
    response.cookies.set("auth_token", adminPass, COOKIE_OPTS);
    if (sitePass) {
      response.cookies.set("site_token", sitePass, COOKIE_OPTS);
    }
    return response;
  }

  // Site password unlocks just the public dashboard.
  if (sitePass && password === sitePass) {
    const response = NextResponse.json({ success: true, role: "site" });
    response.cookies.set("site_token", sitePass, COOKIE_OPTS);
    return response;
  }

  return NextResponse.json({ error: "Invalid password" }, { status: 401 });
}

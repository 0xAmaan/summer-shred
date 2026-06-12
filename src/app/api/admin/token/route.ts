import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Hands the Convex admin API token to logged-in admins only. The admin UI
// fetches this once and attaches the token to every privileged Convex call,
// which re-checks it server-side (convex/lib/auth.ts).
export async function GET() {
  const adminPass = process.env.ADMIN_PASSWORD;
  const authToken = (await cookies()).get("auth_token")?.value;

  if (!adminPass || authToken !== adminPass) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.ADMIN_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      {
        error:
          "ADMIN_API_TOKEN is not configured. Set it in the Next.js environment and on the Convex deployment (npx convex env set ADMIN_API_TOKEN <token>).",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ token });
}

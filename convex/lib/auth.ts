// Server-side admin gate for Convex functions.
//
// Page-level password cookies (src/proxy.ts) only protect the Next.js routes —
// the Convex deployment URL ships in the client bundle, so every public
// function is directly callable by anyone who has loaded the site. Mutations
// that change data therefore re-check authorization here, against a secret
// that only the admin UI (via /api/admin/token) and trusted scripts hold.
//
// Setup: npx convex env set ADMIN_API_TOKEN <token>
// and set the same ADMIN_API_TOKEN in the Next.js environment.

export function isAdmin(adminKey: string | undefined): boolean {
  const expected = process.env.ADMIN_API_TOKEN;
  return Boolean(expected) && adminKey === expected;
}

export function requireAdmin(adminKey: string | undefined): void {
  if (!process.env.ADMIN_API_TOKEN) {
    throw new Error(
      "ADMIN_API_TOKEN is not configured on the Convex deployment. Run: npx convex env set ADMIN_API_TOKEN <token>"
    );
  }
  if (!isAdmin(adminKey)) {
    throw new Error("Not authorized — admin access required.");
  }
}

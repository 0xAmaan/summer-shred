# Summer Shred

A public dashboard for monthly fitness challenges among rotating groups of friends. Each challenge has its own scoring rules, participants, and DEXA scans, plus weekly weigh-ins. AI-vision parses DEXA PDFs into structured metrics; per-month scoring config drives the leaderboard.

## Stack

- **Next.js 16** (App Router, React 19, TypeScript)
- **Convex** for the database, file storage, real-time queries, and server actions
- **Tailwind v4** + **@base-ui/react** + shadcn-style components
- **Anthropic SDK** (PDF document blocks) for parsing DEXA scans
- **recharts** for the weigh-in chart
- Password-cookie auth via Next proxy (two tiers: site + admin)

## Project layout

```
convex/           Schema, queries, mutations, actions (incl. AI PDF parser)
src/app/          App Router routes — public dashboard at /, admin under /admin
src/components/   Dashboard UI, admin panels, shared primitives
src/lib/          Shared scoring engine + utilities (mirrored in convex/lib)
src/proxy.ts      Two-tier password gate
```

## Running locally

```bash
npm install
npx convex dev          # in one terminal — provisions a dev Convex deployment
npm run dev             # in another — Next.js on http://localhost:3000
```

Set the following in `.env.local`:

```bash
CONVEX_DEPLOYMENT=...                    # printed by `npx convex dev`
NEXT_PUBLIC_CONVEX_URL=...               # printed by `npx convex dev`
NEXT_PUBLIC_CONVEX_SITE_URL=...          # printed by `npx convex dev`
SITE_PASSWORD=<your-public-site-password>   # gates the public dashboard
ADMIN_PASSWORD=<your-admin-password>           # gates /admin
```

The Anthropic key lives on the Convex deployment, not in `.env.local`:

```bash
npx convex env set ANTHROPIC_API_KEY sk-ant-...
```

Both `SITE_PASSWORD` and `ADMIN_PASSWORD` are optional. If `SITE_PASSWORD` is unset the public dashboard is open; if `ADMIN_PASSWORD` is unset, `/admin` is unreachable.

## How it works

- **Challenges** live in Convex with their own scoring config (weights, tiebreaker, required metrics) and a markdown rules block.
- **DEXA scans** are decoupled from challenges — `challengeParticipants` is the junction that pins a start scan and end scan per (challenge, participant), so a single end-of-March scan can also serve as start-of-April.
- **PDF upload flow:** admin uploads a DEXA PDF → Convex action sends it to Claude as a document block → strict-JSON metrics → admin confirms in a dialog → saved to `dexaScans`.
- **Scoring** is a pure TS function in `src/lib/scoring.ts` (mirrored in `convex/lib/scoring.ts`) so the same engine runs on both sides.

## Contributing

PRs welcome. Open an issue first for anything non-trivial so we can talk through it.

- Type-check: `npm run lint`
- Build: `npm run build`

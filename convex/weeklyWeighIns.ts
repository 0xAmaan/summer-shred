import { v } from "convex/values";
import { query, mutation, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { isAdmin, requireAdmin } from "./lib/auth";

const DAY_MS = 24 * 60 * 60 * 1000;

const dateMs = (iso: string) => new Date(iso + "T00:00:00Z").getTime();

const addDays = (iso: string, days: number) =>
  new Date(dateMs(iso) + days * DAY_MS).toISOString().slice(0, 10);

/**
 * Self-service submissions re-validate everything the weigh-in form enforces
 * client-side, so the rules hold even against direct Convex calls. Admin
 * calls (valid adminKey) skip this — the grid editor edits any week freely.
 */
async function validateSelfServiceWeighIn(
  ctx: MutationCtx,
  args: {
    challengeId: Id<"challenges">;
    participantId: Id<"participants">;
    weekIndex: number;
    date: string;
    weightLb: number;
  },
  existing: Doc<"weeklyWeighIns"> | null
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
    throw new Error("Invalid date.");
  }
  if (!Number.isFinite(args.weightLb) || args.weightLb < 50 || args.weightLb > 800) {
    throw new Error("Enter a realistic weight in lbs.");
  }

  const challenge = await ctx.db.get(args.challengeId);
  if (!challenge) throw new Error("Challenge not found.");
  if (challenge.status === "completed" || args.date > challenge.endDate) {
    throw new Error("This challenge has ended.");
  }

  const enrolled = await ctx.db
    .query("challengeParticipants")
    .withIndex("by_challenge_and_participant", (q) =>
      q.eq("challengeId", args.challengeId).eq("participantId", args.participantId)
    )
    .first();
  if (!enrolled) {
    throw new Error("You're not enrolled in this challenge.");
  }

  // Weigh-ins are open Fri–Sun. The client sends its local calendar date, so
  // compare weekday on the date itself and allow ~2 days of clock skew around
  // the server's notion of now rather than demanding an exact match.
  const dow = new Date(args.date + "T00:00:00Z").getUTCDay(); // 0=Sun..6=Sat
  if (dow !== 5 && dow !== 6 && dow !== 0) {
    throw new Error("Weigh-ins are open Fri–Sun.");
  }
  if (Math.abs(Date.now() - dateMs(args.date)) > 2 * DAY_MS) {
    throw new Error("Weigh-ins can only be logged for the current weekend.");
  }

  // weekIndex is anchored to challenge.startDate; recompute and reject drift.
  const expectedWeek = Math.max(
    0,
    Math.floor((dateMs(args.date) - dateMs(challenge.startDate)) / (7 * DAY_MS))
  );
  if (args.weekIndex !== expectedWeek) {
    throw new Error("Week number doesn't match the date.");
  }

  // One log per weekend: any existing row dated inside this date's Fri→Mon
  // window blocks a new submission (mirrors the form's dropdown filter).
  const daysBackToFriday = dow === 5 ? 0 : dow === 6 ? 1 : 2;
  const windowStart = addDays(args.date, -daysBackToFriday);
  const windowEnd = addDays(windowStart, 3); // exclusive
  const rows = await ctx.db
    .query("weeklyWeighIns")
    .withIndex("by_challenge_and_participant", (q) =>
      q.eq("challengeId", args.challengeId).eq("participantId", args.participantId)
    )
    .collect();
  const duplicate = rows.find(
    (r) =>
      r._id !== existing?._id && r.date >= windowStart && r.date < windowEnd
  );
  if (duplicate || existing) {
    throw new Error("Already logged this weekend — ask the admin to fix a typo.");
  }
}

export const listByChallenge = query({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("weeklyWeighIns")
      .withIndex("by_challenge", (q) => q.eq("challengeId", args.challengeId))
      .collect();
    return await Promise.all(
      rows.map(async (r) => ({
        ...r,
        participant: await ctx.db.get(r.participantId),
      }))
    );
  },
});

export const upsert = mutation({
  args: {
    adminKey: v.optional(v.string()),
    challengeId: v.id("challenges"),
    participantId: v.id("participants"),
    weekIndex: v.number(),
    date: v.string(),
    weightLb: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { adminKey, ...doc } = args;
    const existing = await ctx.db
      .query("weeklyWeighIns")
      .withIndex("by_challenge_and_participant", (q) =>
        q
          .eq("challengeId", args.challengeId)
          .eq("participantId", args.participantId)
      )
      .filter((q) => q.eq(q.field("weekIndex"), args.weekIndex))
      .first();

    if (!isAdmin(adminKey)) {
      await validateSelfServiceWeighIn(ctx, doc, existing);
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        date: doc.date,
        weightLb: doc.weightLb,
        notes: doc.notes,
      });
      return existing._id;
    }
    return await ctx.db.insert("weeklyWeighIns", doc);
  },
});

export const remove = mutation({
  args: { adminKey: v.optional(v.string()), id: v.id("weeklyWeighIns") },
  handler: async (ctx, args) => {
    requireAdmin(args.adminKey);
    await ctx.db.delete(args.id);
  },
});

/**
 * Bulk import vetted weigh-ins from an external source (e.g. iMessage extract
 * scripts). Looks participants up by lowercase name; idempotently upserts on
 * (challengeId, participantId, weekIndex).
 */
export const bulkImport = mutation({
  args: {
    adminKey: v.optional(v.string()),
    challengeSlug: v.string(),
    entries: v.array(
      v.object({
        participantName: v.string(),
        date: v.string(),
        weekIndex: v.number(),
        weightLb: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminKey);
    const challenge = await ctx.db
      .query("challenges")
      .withIndex("by_slug", (q) => q.eq("slug", args.challengeSlug))
      .first();
    if (!challenge) {
      throw new Error(`Challenge with slug "${args.challengeSlug}" not found`);
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Build a case-insensitive name → participant map once. Cheap (<50 rows)
    // and avoids the per-entry case mismatch problem.
    const allParticipants = await ctx.db.query("participants").collect();
    const byLowerName = new Map(
      allParticipants.map((p) => [p.name.toLowerCase(), p])
    );

    for (const e of args.entries) {
      const participant = byLowerName.get(e.participantName.toLowerCase());
      if (!participant) {
        errors.push(
          `No participant named "${e.participantName}" — skipped ${e.date} ${e.weightLb}lb`
        );
        skipped++;
        continue;
      }

      const existing = await ctx.db
        .query("weeklyWeighIns")
        .withIndex("by_challenge_and_participant", (q) =>
          q
            .eq("challengeId", challenge._id)
            .eq("participantId", participant._id)
        )
        .filter((q) => q.eq(q.field("weekIndex"), e.weekIndex))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          date: e.date,
          weightLb: e.weightLb,
        });
        updated++;
      } else {
        await ctx.db.insert("weeklyWeighIns", {
          challengeId: challenge._id,
          participantId: participant._id,
          date: e.date,
          weekIndex: e.weekIndex,
          weightLb: e.weightLb,
        });
        inserted++;
      }
    }

    return { inserted, updated, skipped, errors };
  },
});

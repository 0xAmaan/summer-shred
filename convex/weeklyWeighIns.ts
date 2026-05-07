import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

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
    challengeId: v.id("challenges"),
    participantId: v.id("participants"),
    weekIndex: v.number(),
    date: v.string(),
    weightLb: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("weeklyWeighIns")
      .withIndex("by_challenge_and_participant", (q) =>
        q
          .eq("challengeId", args.challengeId)
          .eq("participantId", args.participantId)
      )
      .filter((q) => q.eq(q.field("weekIndex"), args.weekIndex))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        date: args.date,
        weightLb: args.weightLb,
        notes: args.notes,
      });
      return existing._id;
    }
    return await ctx.db.insert("weeklyWeighIns", args);
  },
});

export const remove = mutation({
  args: { id: v.id("weeklyWeighIns") },
  handler: async (ctx, args) => {
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

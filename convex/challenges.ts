import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { recomputeChallengeScores } from "./challengeParticipants";

const prizesValidator = v.object({
  winnerUsd: v.optional(v.number()),
  builderUsd: v.optional(v.number()),
});

const scoringValidator = v.object({
  weights: v.object({
    fatLossPct: v.number(),
    leanGainPct: v.number(),
    leanLossPct: v.number(),
    fatGainPct: v.number(),
    almGainPct: v.number(),
    almLossPct: v.number(),
    armsGainPct: v.optional(v.number()),
    legsGainPct: v.optional(v.number()),
  }),
  tiebreaker: v.union(
    v.literal("highest_fat_loss_pct"),
    v.literal("highest_alm_gain_pct"),
    v.literal("highest_lean_gain_pct")
  ),
  requiredMetrics: v.array(
    v.union(
      v.literal("totalMassLb"),
      v.literal("fatMassLb"),
      v.literal("leanMassLb"),
      v.literal("almLb"),
      v.literal("armsLeanLb"),
      v.literal("legsLeanLb"),
      v.literal("bmd"),
      v.literal("bodyFatPct")
    )
  ),
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("challenges").collect();
    return rows.sort((a, b) => b.startDate.localeCompare(a.startDate));
  },
});

export const active = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("challenges").collect();
    const sorted = [...all].sort((a, b) => b.startDate.localeCompare(a.startDate));
    return sorted.find((c) => c.status === "active") ?? sorted[0] ?? null;
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("challenges")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const create = mutation({
  args: {
    adminKey: v.optional(v.string()),
    slug: v.string(),
    name: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    status: v.union(
      v.literal("upcoming"),
      v.literal("active"),
      v.literal("completed")
    ),
    rulesMarkdown: v.optional(v.string()),
    formulaDescription: v.optional(v.string()),
    scoring: scoringValidator,
    prizes: v.optional(prizesValidator),
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminKey);
    const { adminKey: _adminKey, ...doc } = args;
    const existing = await ctx.db
      .query("challenges")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing) throw new Error(`Challenge with slug "${args.slug}" already exists`);
    return await ctx.db.insert("challenges", doc);
  },
});

export const update = mutation({
  args: {
    adminKey: v.optional(v.string()),
    id: v.id("challenges"),
    name: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("upcoming"),
        v.literal("active"),
        v.literal("completed")
      )
    ),
    rulesMarkdown: v.optional(v.string()),
    formulaDescription: v.optional(v.string()),
    scoring: v.optional(scoringValidator),
    prizes: v.optional(prizesValidator),
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminKey);
    const { id, adminKey: _adminKey, ...rest } = args;
    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) updates[k] = v;
    }
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { adminKey: v.optional(v.string()), id: v.id("challenges") },
  handler: async (ctx, args) => {
    requireAdmin(args.adminKey);
    // Cascade delete junction rows + weigh-ins for this challenge
    const cps = await ctx.db
      .query("challengeParticipants")
      .withIndex("by_challenge", (q) => q.eq("challengeId", args.id))
      .collect();
    for (const cp of cps) await ctx.db.delete(cp._id);

    const weighIns = await ctx.db
      .query("weeklyWeighIns")
      .withIndex("by_challenge", (q) => q.eq("challengeId", args.id))
      .collect();
    for (const w of weighIns) await ctx.db.delete(w._id);

    await ctx.db.delete(args.id);
  },
});

/**
 * End one round and start the next in a single step:
 * - Marks the old challenge completed.
 * - Creates the new challenge, cloning scoring/rules/formula/prizes from the
 *   old one (all editable afterwards on the challenge edit page).
 * - Enrolls the selected participants; optionally links each one's end scan
 *   from the old round as their start scan for the new round.
 */
export const transition = mutation({
  args: {
    adminKey: v.optional(v.string()),
    fromChallengeId: v.id("challenges"),
    slug: v.string(),
    name: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    status: v.union(v.literal("upcoming"), v.literal("active")),
    participantIds: v.array(v.id("participants")),
    linkEndScansAsStart: v.boolean(),
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminKey);

    const from = await ctx.db.get(args.fromChallengeId);
    if (!from) throw new Error("Previous challenge not found");

    const existing = await ctx.db
      .query("challenges")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing) throw new Error(`Challenge with slug "${args.slug}" already exists`);

    if (from.status !== "completed") {
      await ctx.db.patch(from._id, { status: "completed" });
    }

    const newChallengeId = await ctx.db.insert("challenges", {
      slug: args.slug,
      name: args.name,
      startDate: args.startDate,
      endDate: args.endDate,
      status: args.status,
      rulesMarkdown: from.rulesMarkdown,
      formulaDescription: from.formulaDescription,
      scoring: from.scoring,
      prizes: from.prizes,
    });

    const oldCps = await ctx.db
      .query("challengeParticipants")
      .withIndex("by_challenge", (q) => q.eq("challengeId", from._id))
      .collect();
    const oldByParticipant = new Map(
      oldCps.map((cp) => [String(cp.participantId), cp])
    );

    for (const participantId of args.participantIds) {
      const oldCp = oldByParticipant.get(String(participantId));
      await ctx.db.insert("challengeParticipants", {
        challengeId: newChallengeId,
        participantId,
        startScanId:
          args.linkEndScansAsStart && oldCp?.endScanId
            ? oldCp.endScanId
            : undefined,
        withdrew: false,
      });
    }

    await recomputeChallengeScores(ctx, newChallengeId);
    return { challengeId: newChallengeId, slug: args.slug };
  },
});

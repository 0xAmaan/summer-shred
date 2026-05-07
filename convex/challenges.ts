import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

const scoringValidator = v.object({
  weights: v.object({
    fatLossPct: v.number(),
    leanGainPct: v.number(),
    leanLossPct: v.number(),
    fatGainPct: v.number(),
    almGainPct: v.number(),
    almLossPct: v.number(),
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("challenges")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing) throw new Error(`Challenge with slug "${args.slug}" already exists`);
    return await ctx.db.insert("challenges", args);
  },
});

export const update = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const { id, ...rest } = args;
    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) updates[k] = v;
    }
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("challenges") },
  handler: async (ctx, args) => {
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

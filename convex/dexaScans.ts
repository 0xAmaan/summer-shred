import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { recomputeScoresForScan } from "./challengeParticipants";

export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const scans = await ctx.db.query("dexaScans").collect();
    return scans.sort((a, b) => b.scanDate.localeCompare(a.scanDate));
  },
});

export const get = query({
  args: { id: v.id("dexaScans") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const listByParticipant = query({
  args: { participantId: v.id("participants") },
  handler: async (ctx, args) => {
    const scans = await ctx.db
      .query("dexaScans")
      .withIndex("by_participant", (q) => q.eq("participantId", args.participantId))
      .collect();
    return scans.sort((a, b) => a.scanDate.localeCompare(b.scanDate));
  },
});

export const create = mutation({
  args: {
    participantId: v.id("participants"),
    scanDate: v.string(),
    totalMassLb: v.optional(v.number()),
    fatMassLb: v.optional(v.number()),
    leanMassLb: v.optional(v.number()),
    armsLeanLb: v.optional(v.number()),
    legsLeanLb: v.optional(v.number()),
    almLb: v.optional(v.number()),
    bmd: v.optional(v.number()),
    bodyFatPct: v.optional(v.number()),
    aiRawResponse: v.optional(v.any()),
    aiConfidence: v.optional(
      v.union(v.literal("high"), v.literal("medium"), v.literal("low"))
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("dexaScans", {
      ...args,
      confirmed: true,
    });
    await recomputeScoresForScan(ctx, id);
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("dexaScans"),
    scanDate: v.optional(v.string()),
    totalMassLb: v.optional(v.number()),
    fatMassLb: v.optional(v.number()),
    leanMassLb: v.optional(v.number()),
    armsLeanLb: v.optional(v.number()),
    legsLeanLb: v.optional(v.number()),
    almLb: v.optional(v.number()),
    bmd: v.optional(v.number()),
    bodyFatPct: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...rest } = args;
    const updates: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(rest)) {
      if (val !== undefined) updates[k] = val;
    }
    // If arms+legs supplied but no almLb override, derive almLb from them so
    // scoring stays in sync. The AI prompt sums these, but a manual edit might
    // change one without the other.
    if (
      updates.almLb === undefined &&
      typeof updates.armsLeanLb === "number" &&
      typeof updates.legsLeanLb === "number"
    ) {
      updates.almLb =
        Math.round((updates.armsLeanLb + updates.legsLeanLb) * 10) / 10;
    }
    await ctx.db.patch(id, updates);
    await recomputeScoresForScan(ctx, id);
  },
});

export const setVetted = mutation({
  args: {
    id: v.id("dexaScans"),
    vetted: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      vettedAt: args.vetted ? Date.now() : undefined,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("dexaScans") },
  handler: async (ctx, args) => {
    const scan = await ctx.db.get(args.id);
    if (!scan) return;
    const cps = await ctx.db.query("challengeParticipants").collect();
    for (const cp of cps) {
      if (cp.startScanId === args.id || cp.endScanId === args.id) {
        await ctx.db.patch(cp._id, {
          startScanId: cp.startScanId === args.id ? undefined : cp.startScanId,
          endScanId: cp.endScanId === args.id ? undefined : cp.endScanId,
        });
      }
    }
    await ctx.db.delete(args.id);
  },
});

const aiScanShape = v.object({
  scanDate: v.string(),
  totalMassLb: v.union(v.number(), v.null()),
  fatMassLb: v.union(v.number(), v.null()),
  leanMassLb: v.union(v.number(), v.null()),
  armsLeanLb: v.union(v.number(), v.null()),
  legsLeanLb: v.union(v.number(), v.null()),
  almLb: v.union(v.number(), v.null()),
  bmd: v.union(v.number(), v.null()),
  bodyFatPct: v.union(v.number(), v.null()),
});

const confidenceShape = v.union(
  v.literal("high"),
  v.literal("medium"),
  v.literal("low")
);

/**
 * Non-destructive AI ingest for one extracted scan.
 * - If a scan row already exists for (participant, date): only patch aiRawResponse + aiConfidence.
 *   Confirmed metric values are preserved.
 * - Otherwise: insert a new scan row with the AI metrics, mark confirmed=true.
 */
export const upsertFromAi = mutation({
  args: {
    participantId: v.id("participants"),
    aiScan: aiScanShape,
    aiConfidence: confidenceShape,
    aiRaw: v.any(),
  },
  handler: async (ctx, args) => {
    const { participantId, aiScan, aiConfidence, aiRaw } = args;
    const existing = await ctx.db
      .query("dexaScans")
      .withIndex("by_participant_and_date", (q) =>
        q.eq("participantId", participantId).eq("scanDate", aiScan.scanDate)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        aiRawResponse: aiRaw,
        aiConfidence,
      });
      return { action: "updatedAiOnly" as const, scanId: existing._id };
    }

    const numOrUndef = (n: number | null): number | undefined =>
      n === null ? undefined : n;

    const newId = await ctx.db.insert("dexaScans", {
      participantId,
      scanDate: aiScan.scanDate,
      totalMassLb: numOrUndef(aiScan.totalMassLb),
      fatMassLb: numOrUndef(aiScan.fatMassLb),
      leanMassLb: numOrUndef(aiScan.leanMassLb),
      armsLeanLb: numOrUndef(aiScan.armsLeanLb),
      legsLeanLb: numOrUndef(aiScan.legsLeanLb),
      almLb: numOrUndef(aiScan.almLb),
      bmd: numOrUndef(aiScan.bmd),
      bodyFatPct: numOrUndef(aiScan.bodyFatPct),
      confirmed: true,
      aiRawResponse: aiRaw,
      aiConfidence,
    });
    await recomputeScoresForScan(ctx, newId);
    return { action: "created" as const, scanId: newId };
  },
});

const metricKeyShape = v.union(
  v.literal("totalMassLb"),
  v.literal("fatMassLb"),
  v.literal("leanMassLb"),
  v.literal("armsLeanLb"),
  v.literal("legsLeanLb"),
  v.literal("almLb"),
  v.literal("bmd"),
  v.literal("bodyFatPct")
);

/**
 * Apply the AI-extracted values for this scan's date onto the scan's confirmed
 * metric fields. Only fields that are non-null in the AI response are written.
 *
 * If `fields` is supplied, only those keys are applied. If "armsLeanLb" or
 * "legsLeanLb" are in the applied set, almLb gets re-derived from the resulting
 * arms+legs sum (so scoring stays consistent).
 */
export const applyAiToScan = mutation({
  args: {
    id: v.id("dexaScans"),
    fields: v.optional(v.array(metricKeyShape)),
  },
  handler: async (ctx, args) => {
    const scan = await ctx.db.get(args.id);
    if (!scan) throw new Error("Scan not found");
    const raw = scan.aiRawResponse as
      | { scans?: Array<Record<string, unknown>> }
      | undefined;
    const matching = raw?.scans?.find(
      (s) => String(s.scanDate ?? "") === scan.scanDate
    );
    if (!matching) {
      throw new Error("No AI extraction matches this scan's date");
    }

    const num = (v: unknown): number | undefined => {
      if (v === null || v === undefined) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    const allKeys: Array<
      "totalMassLb" | "fatMassLb" | "leanMassLb" | "armsLeanLb" |
      "legsLeanLb" | "almLb" | "bmd" | "bodyFatPct"
    > = [
      "totalMassLb",
      "fatMassLb",
      "leanMassLb",
      "armsLeanLb",
      "legsLeanLb",
      "almLb",
      "bmd",
      "bodyFatPct",
    ];
    const targetKeys = args.fields ?? allKeys;

    const updates: Record<string, unknown> = {};
    for (const k of targetKeys) {
      const v = num(matching[k]);
      if (v !== undefined) updates[k] = v;
    }

    // If we touched arms or legs but not almLb directly, re-derive almLb so
    // scoring stays in sync with the new values.
    const touchedArms = "armsLeanLb" in updates;
    const touchedLegs = "legsLeanLb" in updates;
    const explicitlyTouchedAlm = targetKeys.includes("almLb");
    if ((touchedArms || touchedLegs) && !explicitlyTouchedAlm) {
      const arms =
        (updates.armsLeanLb as number | undefined) ?? scan.armsLeanLb;
      const legs =
        (updates.legsLeanLb as number | undefined) ?? scan.legsLeanLb;
      if (typeof arms === "number" && typeof legs === "number") {
        updates.almLb = Math.round((arms + legs) * 10) / 10;
      }
    }

    await ctx.db.patch(args.id, updates);
    await recomputeScoresForScan(ctx, args.id);
  },
});

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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

export default defineSchema({
  challenges: defineTable({
    slug: v.string(),
    name: v.string(),
    startDate: v.string(),  // ISO YYYY-MM-DD
    endDate: v.string(),
    status: v.union(
      v.literal("upcoming"),
      v.literal("active"),
      v.literal("completed")
    ),
    rulesMarkdown: v.optional(v.string()),
    formulaDescription: v.optional(v.string()),
    scoring: scoringValidator,
    prizes: v.optional(
      v.object({
        winnerUsd: v.optional(v.number()),
        builderUsd: v.optional(v.number()),
      })
    ),
    canonicalStartDate: v.optional(v.string()),
    canonicalEndDate: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_start_date", ["startDate"]),

  participants: defineTable({
    name: v.string(),
    displayName: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    color: v.optional(v.string()),
    currentReportStorageId: v.optional(v.id("_storage")),
    currentReportUploadedAt: v.optional(v.number()),
  }).index("by_name", ["name"]),

  dexaScans: defineTable({
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
    confirmed: v.boolean(),
    vettedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_participant", ["participantId"])
    .index("by_participant_and_date", ["participantId", "scanDate"])
    .index("by_date", ["scanDate"]),

  challengeParticipants: defineTable({
    challengeId: v.id("challenges"),
    participantId: v.id("participants"),
    startScanId: v.optional(v.id("dexaScans")),
    endScanId: v.optional(v.id("dexaScans")),
    cachedScore: v.optional(v.number()),
    cachedTiebreakerValue: v.optional(v.number()),
    cachedScorable: v.optional(v.boolean()),
    cachedBreakdown: v.optional(v.any()),
    cachedRank: v.optional(v.number()),
    withdrew: v.optional(v.boolean()),
  })
    .index("by_challenge", ["challengeId"])
    .index("by_challenge_and_participant", ["challengeId", "participantId"])
    .index("by_participant", ["participantId"]),

  weeklyWeighIns: defineTable({
    challengeId: v.id("challenges"),
    participantId: v.id("participants"),
    weekIndex: v.number(),
    date: v.string(),
    weightLb: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_challenge", ["challengeId"])
    .index("by_challenge_and_week", ["challengeId", "weekIndex"])
    .index("by_challenge_and_participant", ["challengeId", "participantId"]),

  settings: defineTable({
    key: v.string(),
    value: v.any(),
  }).index("by_key", ["key"]),
});

import { v } from "convex/values";
import { query, mutation, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import {
  computeScore,
  rankParticipants,
  type ScoringConfig,
  type ScanMetrics,
} from "./lib/scoring";

type ScanWithUrl = (Doc<"dexaScans"> & { pdfUrl: string | null }) | null;

interface LeaderboardEntry {
  challengeParticipantId: Id<"challengeParticipants">;
  participantId: Id<"participants">;
  participantName: string;
  participantColor: string | null;
  startScanId: Id<"dexaScans"> | null;
  endScanId: Id<"dexaScans"> | null;
  startScan: ScanWithUrl;
  endScan: ScanWithUrl;
  score: number;
  tiebreakerValue: number;
  scorable: boolean;
  breakdown: ReturnType<typeof computeScore>["breakdown"];
  rank: number | null;
  withdrew: boolean;
}

function pickMetrics(scan: Doc<"dexaScans"> | null): ScanMetrics | null {
  if (!scan) return null;
  return {
    totalMassLb: scan.totalMassLb,
    fatMassLb: scan.fatMassLb,
    leanMassLb: scan.leanMassLb,
    almLb: scan.almLb,
    armsLeanLb: scan.armsLeanLb,
    legsLeanLb: scan.legsLeanLb,
    bmd: scan.bmd,
    bodyFatPct: scan.bodyFatPct,
  };
}

export const leaderboard = query({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, args): Promise<LeaderboardEntry[]> => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) return [];

    const cps = await ctx.db
      .query("challengeParticipants")
      .withIndex("by_challenge", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    const enriched = await Promise.all(
      cps.map(async (cp) => {
        const participant = await ctx.db.get(cp.participantId);
        const reportUrl = participant?.currentReportStorageId
          ? await ctx.storage.getUrl(participant.currentReportStorageId)
          : null;
        const startScanRaw = cp.startScanId ? await ctx.db.get(cp.startScanId) : null;
        const endScanRaw = cp.endScanId ? await ctx.db.get(cp.endScanId) : null;
        const startScan: ScanWithUrl = startScanRaw
          ? { ...startScanRaw, pdfUrl: reportUrl }
          : null;
        const endScan: ScanWithUrl = endScanRaw
          ? { ...endScanRaw, pdfUrl: reportUrl }
          : null;
        const result = computeScore(
          challenge.scoring as ScoringConfig,
          pickMetrics(startScanRaw),
          pickMetrics(endScanRaw)
        );
        return {
          challengeParticipantId: cp._id,
          participantId: cp.participantId,
          participantName: participant?.name ?? "Unknown",
          participantColor: participant?.color ?? null,
          startScanId: cp.startScanId ?? null,
          endScanId: cp.endScanId ?? null,
          startScan,
          endScan,
          score: result.score,
          tiebreakerValue: result.tiebreakerValue,
          scorable: result.scorable,
          breakdown: result.breakdown,
          rank: null as number | null,
          withdrew: cp.withdrew ?? false,
        };
      })
    );

    return rankParticipants(enriched.filter((e) => !e.withdrew)).concat(
      enriched.filter((e) => e.withdrew).map((e) => ({ ...e, rank: null }))
    );
  },
});

export const listByChallenge = query({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, args) => {
    const cps = await ctx.db
      .query("challengeParticipants")
      .withIndex("by_challenge", (q) => q.eq("challengeId", args.challengeId))
      .collect();
    return await Promise.all(
      cps.map(async (cp) => ({
        ...cp,
        participant: await ctx.db.get(cp.participantId),
      }))
    );
  },
});

export const listForChallengeWithScans = query({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, args) => {
    const cps = await ctx.db
      .query("challengeParticipants")
      .withIndex("by_challenge", (q) => q.eq("challengeId", args.challengeId))
      .collect();
    return await Promise.all(
      cps.map(async (cp) => {
        const participant = await ctx.db.get(cp.participantId);
        const scans = await ctx.db
          .query("dexaScans")
          .withIndex("by_participant", (q) =>
            q.eq("participantId", cp.participantId)
          )
          .collect();
        scans.sort((a, b) => a.scanDate.localeCompare(b.scanDate));
        return {
          challengeParticipantId: cp._id,
          participantId: cp.participantId,
          participantName: participant?.name ?? "Unknown",
          startScanId: cp.startScanId ?? null,
          endScanId: cp.endScanId ?? null,
          withdrew: cp.withdrew ?? false,
          scans: scans.map((s) => ({
            _id: s._id,
            scanDate: s.scanDate,
            confirmed: s.confirmed,
            totalMassLb: s.totalMassLb,
            fatMassLb: s.fatMassLb,
            leanMassLb: s.leanMassLb,
            almLb: s.almLb,
            bodyFatPct: s.bodyFatPct,
            bmd: s.bmd,
          })),
        };
      })
    );
  },
});

export const upsert = mutation({
  args: {
    challengeId: v.id("challenges"),
    participantId: v.id("participants"),
    startScanId: v.optional(v.id("dexaScans")),
    endScanId: v.optional(v.id("dexaScans")),
    withdrew: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("challengeParticipants")
      .withIndex("by_challenge_and_participant", (q) =>
        q.eq("challengeId", args.challengeId).eq("participantId", args.participantId)
      )
      .first();

    const updates: Record<string, unknown> = {};
    if (args.startScanId !== undefined) updates.startScanId = args.startScanId;
    if (args.endScanId !== undefined) updates.endScanId = args.endScanId;
    if (args.withdrew !== undefined) updates.withdrew = args.withdrew;

    let id: Id<"challengeParticipants">;
    if (existing) {
      await ctx.db.patch(existing._id, updates);
      id = existing._id;
    } else {
      id = await ctx.db.insert("challengeParticipants", {
        challengeId: args.challengeId,
        participantId: args.participantId,
        startScanId: args.startScanId,
        endScanId: args.endScanId,
        withdrew: args.withdrew ?? false,
      });
    }
    await recomputeChallengeScores(ctx, args.challengeId);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("challengeParticipants") },
  handler: async (ctx, args) => {
    const cp = await ctx.db.get(args.id);
    if (!cp) return;
    await ctx.db.delete(args.id);
    await recomputeChallengeScores(ctx, cp.challengeId);
  },
});

export async function recomputeChallengeScores(
  ctx: MutationCtx,
  challengeId: Id<"challenges">
) {
  const challenge = await ctx.db.get(challengeId);
  if (!challenge) return;

  const cps = await ctx.db
    .query("challengeParticipants")
    .withIndex("by_challenge", (q) => q.eq("challengeId", challengeId))
    .collect();

  const computed = await Promise.all(
    cps.map(async (cp) => {
      const startScan = cp.startScanId ? await ctx.db.get(cp.startScanId) : null;
      const endScan = cp.endScanId ? await ctx.db.get(cp.endScanId) : null;
      const result = computeScore(
        challenge.scoring as ScoringConfig,
        pickMetrics(startScan),
        pickMetrics(endScan)
      );
      return { cp, result };
    })
  );

  // Rank only non-withdrawn, scorable rows
  const eligible = computed.filter(({ cp, result }) => !cp.withdrew && result.scorable);
  eligible.sort(
    (a, b) =>
      b.result.score - a.result.score ||
      b.result.tiebreakerValue - a.result.tiebreakerValue
  );
  const rankMap = new Map<Id<"challengeParticipants">, number>();
  eligible.forEach(({ cp }, i) => rankMap.set(cp._id, i + 1));

  for (const { cp, result } of computed) {
    await ctx.db.patch(cp._id, {
      cachedScore: result.score,
      cachedTiebreakerValue: result.tiebreakerValue,
      cachedScorable: result.scorable,
      cachedBreakdown: result.breakdown,
      cachedRank: rankMap.get(cp._id) ?? undefined,
    });
  }
}

// Called from dexaScans.create / update to recompute every challenge that
// references this scan as start or end.
export async function recomputeScoresForScan(
  ctx: MutationCtx,
  scanId: Id<"dexaScans">
) {
  const cps = await ctx.db.query("challengeParticipants").collect();
  const affectedChallenges = new Set<Id<"challenges">>();
  for (const cp of cps) {
    if (cp.startScanId === scanId || cp.endScanId === scanId) {
      affectedChallenges.add(cp.challengeId);
    }
  }
  for (const cid of affectedChallenges) {
    await recomputeChallengeScores(ctx, cid);
  }
}

export const recompute = mutation({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, args) => {
    await recomputeChallengeScores(ctx, args.challengeId);
  },
});

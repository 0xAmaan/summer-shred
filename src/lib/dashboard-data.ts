"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { ScoringConfig, ScoreBreakdown } from "@/lib/scoring";

export interface ScanLite {
  scanDate: string;
  totalMassLb?: number;
  fatMassLb?: number;
  leanMassLb?: number;
  armsLeanLb?: number;
  legsLeanLb?: number;
  almLb?: number;
  bmd?: number;
  bodyFatPct?: number;
  pdfUrl: string | null;
}

export interface DashRow {
  challengeParticipantId: string;
  participantId: string;
  participantName: string;
  participantColor: string | null;
  startScan: ScanLite | null;
  endScan: ScanLite | null;
  score: number;
  scorable: boolean;
  rank: number | null;
  withdrew: boolean;
  breakdown: ScoreBreakdown;
}

export interface ChallengeLite {
  _id: string;
  slug: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "upcoming" | "active" | "completed";
  rulesMarkdown?: string;
  scoring: ScoringConfig;
  /** 1-based, computed by sorting all challenges by startDate ASC. */
  round: number;
}

export interface DashStats {
  /** Eligible (scorable, not withdrawn) participants. */
  eligibleCount: number;
  /** All non-withdrawn participants in this challenge. */
  totalCount: number;
  /** Sum of |fat lost| in lb across rows that lost fat (positive number). */
  groupFatLostLb: number;
  /** Sum of net lean change in lb across all scorable rows (signed). */
  groupLeanChangeLb: number;
  /** Sum of net ALM change in lb (signed). */
  groupAlmChangeLb: number;
  totalDays: number;
  daysElapsed: number;
  /** True for active challenge: clamps elapsed to [0, totalDays]. */
  inProgress: boolean;
  /** True iff at least one row has scorable=true (i.e. has both start+end scans). */
  hasEndScans: boolean;
}

export interface WeighInRow {
  weekIndex: number;
  date: string;
  weightLb: number;
  participantName: string;
  participantId: string;
  participantColor: string | null;
}

export interface WeighInLeader {
  participantName: string;
  participantColor: string | null;
  baselineLb: number;
  latestLb: number;
  changeLb: number;
}

export interface DashboardData {
  isLoading: boolean;
  hasNoChallenges: boolean;
  /** All challenges sorted by startDate ASC, with `round` populated. */
  rounds: { slug: string; name: string; round: number; status: ChallengeLite["status"]; startDate: string }[];
  challenge: ChallengeLite | null;
  rows: DashRow[];
  weighIns: WeighInRow[];
  /** Best weight-loss leader from weigh-in data. Null if no weigh-ins. */
  weighInLeader: WeighInLeader | null;
  stats: DashStats | null;
}

function daysBetween(a: string, b: string): number {
  const t1 = new Date(a + "T00:00:00").getTime();
  const t2 = new Date(b + "T00:00:00").getTime();
  return Math.max(1, Math.round((t2 - t1) / 86_400_000));
}

/**
 * Look up a challenge by 1-based round number, or — if `round` is null/undefined —
 * default to the active challenge (or the latest if none active).
 */
export function useDashboardData(round?: number | null): DashboardData {
  const challenges = useQuery(api.challenges.list);

  const sortedRounds = React.useMemo(() => {
    if (!challenges) return [];
    return [...challenges]
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((c, i) => ({
        slug: c.slug,
        name: c.name,
        startDate: c.startDate,
        status: c.status,
        round: i + 1,
      }));
  }, [challenges]);

  const targetRound = React.useMemo(() => {
    if (round) {
      return sortedRounds.find((r) => r.round === round)?.slug ?? null;
    }
    const active = sortedRounds.find((r) => r.status === "active");
    if (active) return active.slug;
    return sortedRounds[sortedRounds.length - 1]?.slug ?? null;
  }, [round, sortedRounds]);

  const challenge = useQuery(
    api.challenges.getBySlug,
    targetRound ? { slug: targetRound } : "skip"
  );

  const leaderboard = useQuery(
    api.challengeParticipants.leaderboard,
    challenge ? { challengeId: challenge._id } : "skip"
  );

  const weighIns = useQuery(
    api.weeklyWeighIns.listByChallenge,
    challenge ? { challengeId: challenge._id } : "skip"
  );

  const isLoading =
    challenges === undefined ||
    (targetRound !== null &&
      (challenge === undefined || leaderboard === undefined));

  const rows: DashRow[] = React.useMemo(() => {
    if (!leaderboard) return [];
    return leaderboard.map((r) => ({
      challengeParticipantId: String(r.challengeParticipantId),
      participantId: String(r.participantId),
      participantName: r.participantName,
      participantColor: r.participantColor,
      startScan: r.startScan
        ? {
            scanDate: r.startScan.scanDate,
            totalMassLb: r.startScan.totalMassLb,
            fatMassLb: r.startScan.fatMassLb,
            leanMassLb: r.startScan.leanMassLb,
            armsLeanLb: r.startScan.armsLeanLb,
            legsLeanLb: r.startScan.legsLeanLb,
            almLb: r.startScan.almLb,
            bmd: r.startScan.bmd,
            bodyFatPct: r.startScan.bodyFatPct,
            pdfUrl: r.startScan.pdfUrl,
          }
        : null,
      endScan: r.endScan
        ? {
            scanDate: r.endScan.scanDate,
            totalMassLb: r.endScan.totalMassLb,
            fatMassLb: r.endScan.fatMassLb,
            leanMassLb: r.endScan.leanMassLb,
            armsLeanLb: r.endScan.armsLeanLb,
            legsLeanLb: r.endScan.legsLeanLb,
            almLb: r.endScan.almLb,
            bmd: r.endScan.bmd,
            bodyFatPct: r.endScan.bodyFatPct,
            pdfUrl: r.endScan.pdfUrl,
          }
        : null,
      score: r.score,
      scorable: r.scorable,
      rank: r.rank,
      withdrew: r.withdrew,
      breakdown: r.breakdown,
    }));
  }, [leaderboard]);

  const colorByName = React.useMemo(() => {
    const m = new Map<string, string | null>();
    for (const r of rows) m.set(r.participantName, r.participantColor);
    return m;
  }, [rows]);
  const idByName = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) m.set(r.participantName, r.participantId);
    return m;
  }, [rows]);

  const weighInRows: WeighInRow[] = React.useMemo(() => {
    const manual: WeighInRow[] =
      weighIns?.map((w) => {
        const name = w.participant?.name ?? "Unknown";
        return {
          weekIndex: w.weekIndex,
          date: w.date,
          weightLb: w.weightLb,
          participantName: name,
          participantId: idByName.get(name) ?? String(w.participantId),
          participantColor: colorByName.get(name) ?? null,
        };
      }) ?? [];

    // Merge in DEXA scan weights as virtual weigh-ins so the chart shows
    // start and end measurements without having to mirror them into the
    // weeklyWeighIns table. Scan-derived points win over manual entries
    // for the same (participant, weekIndex).
    if (!challenge || !leaderboard) return manual;
    const startMs = new Date(challenge.startDate + "T00:00:00").getTime();
    const weekFor = (iso: string) => {
      const d = new Date(iso + "T00:00:00").getTime();
      return Math.max(0, Math.floor((d - startMs) / (7 * 24 * 60 * 60 * 1000)));
    };
    const scanRows: WeighInRow[] = [];
    for (const r of leaderboard) {
      for (const scan of [r.startScan, r.endScan]) {
        if (!scan || typeof scan.totalMassLb !== "number") continue;
        scanRows.push({
          weekIndex: weekFor(scan.scanDate),
          date: scan.scanDate,
          weightLb: scan.totalMassLb,
          participantName: r.participantName,
          participantId: String(r.participantId),
          participantColor: r.participantColor,
        });
      }
    }

    const scanKeys = new Set(
      scanRows.map((r) => `${r.participantName}:${r.weekIndex}`)
    );
    const filteredManual = manual.filter(
      (m) => !scanKeys.has(`${m.participantName}:${m.weekIndex}`)
    );
    return [...filteredManual, ...scanRows];
  }, [weighIns, idByName, colorByName, challenge, leaderboard]);

  // Compute weigh-in leader: largest weight loss from earliest week to latest.
  const weighInLeader: WeighInLeader | null = React.useMemo(() => {
    if (weighInRows.length === 0) return null;
    type Per = { earliest: WeighInRow; latest: WeighInRow };
    const byParticipant = new Map<string, Per>();
    for (const w of weighInRows) {
      const key = w.participantName;
      const cur = byParticipant.get(key);
      if (!cur) {
        byParticipant.set(key, { earliest: w, latest: w });
        continue;
      }
      if (w.weekIndex < cur.earliest.weekIndex) cur.earliest = w;
      if (w.weekIndex > cur.latest.weekIndex) cur.latest = w;
    }
    let best: WeighInLeader | null = null;
    for (const { earliest, latest } of byParticipant.values()) {
      if (earliest.weekIndex === latest.weekIndex) continue; // need a delta
      const change = latest.weightLb - earliest.weightLb;
      if (best === null || change < best.changeLb) {
        best = {
          participantName: latest.participantName,
          participantColor: latest.participantColor,
          baselineLb: earliest.weightLb,
          latestLb: latest.weightLb,
          changeLb: change,
        };
      }
    }
    return best;
  }, [weighInRows]);

  const stats: DashStats | null = React.useMemo(() => {
    if (!challenge || !leaderboard) return null;

    const eligible = rows.filter((r) => r.scorable && !r.withdrew);
    const totalDays = daysBetween(challenge.startDate, challenge.endDate);
    const today = new Date().toISOString().slice(0, 10);
    const elapsedRaw = daysBetween(
      challenge.startDate,
      today < challenge.startDate
        ? challenge.startDate
        : today > challenge.endDate
          ? challenge.endDate
          : today
    );
    const daysElapsed =
      challenge.status === "completed" ? totalDays : elapsedRaw;

    let groupFatLostLb = 0;
    let groupLeanChangeLb = 0;
    let groupAlmChangeLb = 0;
    for (const r of eligible) {
      const fat = r.breakdown.fatChangeLb;
      if (fat !== null && fat < 0) groupFatLostLb += -fat;
      if (r.breakdown.leanChangeLb !== null)
        groupLeanChangeLb += r.breakdown.leanChangeLb;
      if (r.breakdown.almChangeLb !== null)
        groupAlmChangeLb += r.breakdown.almChangeLb;
    }

    return {
      eligibleCount: eligible.length,
      totalCount: rows.filter((r) => !r.withdrew).length,
      groupFatLostLb,
      groupLeanChangeLb,
      groupAlmChangeLb,
      totalDays,
      daysElapsed,
      inProgress: challenge.status === "active",
      hasEndScans: eligible.length > 0,
    };
  }, [challenge, leaderboard, rows]);

  // Find the round number for the current challenge so consumers can build URLs.
  const currentRoundNumber =
    challenge && sortedRounds.find((r) => r.slug === challenge.slug)?.round;

  return {
    isLoading,
    hasNoChallenges: challenges !== undefined && challenges.length === 0,
    rounds: sortedRounds,
    challenge: challenge
      ? {
          _id: String(challenge._id),
          slug: challenge.slug,
          name: challenge.name,
          startDate: challenge.startDate,
          endDate: challenge.endDate,
          status: challenge.status,
          rulesMarkdown: challenge.rulesMarkdown,
          scoring: challenge.scoring as ScoringConfig,
          round: currentRoundNumber ?? 0,
        }
      : null,
    rows,
    weighIns: weighInRows,
    weighInLeader,
    stats,
  };
}

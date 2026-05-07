"use client";

import * as React from "react";
import Link from "next/link";
import "@/components/dashboard/tokens.css";
import { fraunces } from "@/components/dashboard/fonts";
import { useDashboardData } from "@/lib/dashboard-data";
import {
  useScanPreview,
  ScanPreviewDialog,
} from "@/components/shared/scan-preview-dialog";
import { V1ChallengeTabs } from "@/components/dashboard/shell";
import { V1Header } from "@/components/dashboard/header";
import { V1StatStrip } from "@/components/dashboard/stat-strip";
import { V1Podium } from "@/components/dashboard/podium";
import { V1Leaderboard } from "@/components/dashboard/leaderboard";
import { V1ScanCard } from "@/components/dashboard/scan-card";
import { V1CriteriaCard } from "@/components/dashboard/criteria-card";
import { V1WeighInChart } from "@/components/dashboard/weighin-chart";

export function DashboardScreen({ round }: { round: number | null }) {
  const data = useDashboardData(round);
  const { preview, open, close } = useScanPreview();

  if (data.hasNoChallenges) {
    return (
      <Shell>
        <div className="mx-auto w-full max-w-3xl px-6 py-24 text-center space-y-3">
          <h1 className="v1-display text-4xl">No challenges yet</h1>
          <p className="v1-display-italic text-[color:var(--v1-ink-mute)]">
            Create one from the admin panel to get started.
          </p>
        </div>
      </Shell>
    );
  }

  if (data.isLoading || !data.challenge || !data.stats) {
    return (
      <Shell>
        <DashboardSkeleton />
      </Shell>
    );
  }

  const sorted = [...data.rows].sort(
    (a, b) => (a.rank ?? 999) - (b.rank ?? 999)
  );
  const showLeaderboard = data.stats.hasEndScans;

  return (
    <Shell>
      <main className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-12 xl:px-20 py-8 sm:py-12 lg:py-16 space-y-10 sm:space-y-12 lg:space-y-16">
        <V1ChallengeTabs rounds={data.rounds} activeRound={data.challenge.round} />
        <V1Header challenge={data.challenge} stats={data.stats} />
        {data.stats.hasEndScans && (
          <V1StatStrip stats={data.stats} challenge={data.challenge} />
        )}
        <V1Podium
          challenge={data.challenge}
          stats={data.stats}
          leaderRow={data.rows.find((r) => r.scorable && r.rank === 1) ?? null}
          weighInLeader={data.weighInLeader}
          topRows={sorted
            .filter((r) => r.scorable && r.rank !== null)
            .slice(0, 3)}
        />
        <div className="grid gap-10 sm:gap-12 lg:gap-16 lg:grid-cols-[3fr_2fr]">
          {showLeaderboard ? (
            <V1Leaderboard rows={data.rows} />
          ) : (
            <ChallengersList rows={data.rows} />
          )}
          <V1CriteriaCard
            rulesMarkdown={data.challenge.rulesMarkdown}
            scoring={data.challenge.scoring}
          />
        </div>
        <V1WeighInChart
          weighIns={data.weighIns}
          challengeStartDate={data.challenge.startDate}
        />
        <section className="space-y-4 sm:space-y-6">
          <div className="flex items-baseline justify-between">
            <h2 className="v1-display text-[22px] sm:text-[26px] font-medium">
              DEXA scans
            </h2>
            <span className="v1-smallcaps text-[12px] sm:text-[13px]">
              {sorted.length} entries
            </span>
          </div>
          <div className="v1-rule" />
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
            {sorted.map((r) => (
              <V1ScanCard
                key={r.challengeParticipantId}
                participantName={r.participantName}
                participantColor={r.participantColor}
                startScan={r.startScan}
                endScan={r.endScan}
                rank={r.rank}
                scoring={data.challenge!.scoring}
                onPreview={open}
              />
            ))}
          </div>
        </section>
        <footer className="pt-8 pb-4">
          <div className="v1-rule-thin" />
          <div className="mt-4 flex items-baseline justify-between gap-4">
            <p className="v1-smallcaps text-[12px] text-[color:var(--v1-ink-mute)]">
              Set in Fraunces and Inter
            </p>
            <Link
              href="/admin"
              className="v1-smallcaps text-[12px] text-[color:var(--v1-ink-mute)] hover:text-[color:var(--v1-terracotta)] transition-colors"
            >
              Admin →
            </Link>
          </div>
        </footer>
      </main>
      <ScanPreviewDialog preview={preview} onClose={close} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className={`vibe-v1 ${fraunces.variable} flex-1 min-h-screen w-full`}>
      {children}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-screen-2xl px-6 lg:px-12 xl:px-20 py-12 space-y-12">
      <div className="h-12 w-1/3 bg-[color:var(--v1-cream-deep)] animate-pulse rounded-sm" />
      <div className="h-32 w-full bg-[color:var(--v1-cream-deep)] animate-pulse rounded-sm" />
      <div className="grid gap-6 md:grid-cols-3">
        <div className="h-48 bg-[color:var(--v1-cream-deep)] animate-pulse rounded-sm" />
        <div className="h-48 bg-[color:var(--v1-cream-deep)] animate-pulse rounded-sm" />
        <div className="h-48 bg-[color:var(--v1-cream-deep)] animate-pulse rounded-sm" />
      </div>
    </div>
  );
}

function ChallengersList({ rows }: { rows: import("@/lib/dashboard-data").DashRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="v1-display text-[22px] sm:text-[26px] font-medium">
          Challengers
        </h2>
        <span className="v1-smallcaps text-[12px] sm:text-[13px]">
          {rows.length} in
        </span>
      </div>
      <div className="v1-rule" />
      <ul className="flex flex-wrap items-baseline justify-center gap-x-6 sm:gap-x-8 gap-y-3 sm:gap-y-4 py-3 sm:py-6">
        {rows.map((r, i) => (
          <React.Fragment key={r.challengeParticipantId}>
            {i > 0 && (
              <li
                aria-hidden
                className="text-[color:var(--v1-ink-mute)]/40 v1-display select-none hidden sm:inline"
              >
                ·
              </li>
            )}
            <li className="inline-flex items-baseline gap-2 sm:gap-2.5">
              <span
                className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full shrink-0 translate-y-[1px] sm:translate-y-0"
                style={{
                  backgroundColor:
                    r.participantColor ?? "var(--v1-ink-mute)",
                }}
              />
              <span className="v1-display text-[17px] sm:text-[20px] leading-none text-[color:var(--v1-ink)]">
                {r.participantName}
              </span>
              {r.withdrew && (
                <span className="v1-display-italic text-[12px] sm:text-[13px] text-[color:var(--v1-ink-mute)]">
                  (out)
                </span>
              )}
            </li>
          </React.Fragment>
        ))}
      </ul>
    </section>
  );
}

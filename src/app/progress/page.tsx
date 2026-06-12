"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import "@/components/dashboard/tokens.css";
import { fraunces } from "@/components/dashboard/fonts";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { FALLBACK_COLOR } from "@/lib/constants";

const METRICS = [
  { key: "bodyFatPct", label: "Body fat %", unit: "%" },
  { key: "leanMassLb", label: "Lean mass", unit: "lb" },
  { key: "almLb", label: "ALM", unit: "lb" },
  { key: "totalMassLb", label: "Total weight", unit: "lb" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

function shortDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

function delta(first: number | undefined, last: number | undefined) {
  if (first === undefined || last === undefined) return null;
  return Math.round((last - first) * 10) / 10;
}

export default function ProgressPage() {
  const participants = useQuery(api.participants.list);
  const [chosenId, setParticipantId] = React.useState<Id<"participants"> | "">("");
  // Until the user picks someone, default to the first participant.
  const participantId = chosenId || participants?.[0]?._id || "";

  const scans = useQuery(
    api.dexaScans.listByParticipant,
    participantId ? { participantId } : "skip"
  );

  const selected = participants?.find((p) => p._id === participantId);
  const color = selected?.color ?? FALLBACK_COLOR;

  const first = scans?.[0];
  const last = scans && scans.length > 1 ? scans[scans.length - 1] : undefined;

  return (
    <div className={`vibe-v1 ${fraunces.variable} flex-1 min-h-screen w-full`}>
      <main className="mx-auto w-full max-w-screen-lg px-4 sm:px-6 lg:px-12 py-8 sm:py-12 space-y-8">
        <header className="space-y-2">
          <p className="v1-smallcaps">Summer Shred</p>
          <h1 className="v1-display text-4xl font-medium">Progress</h1>
          <p className="v1-display-italic text-[15px] text-[color:var(--v1-ink-mute)]">
            Every DEXA scan across every round, one person at a time.
          </p>
        </header>

        <div className="v1-rule" />

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {(participants ?? []).map((p) => {
            const isActive = p._id === participantId;
            return (
              <button
                key={p._id}
                type="button"
                onClick={() => setParticipantId(p._id)}
                className={
                  "v1-display text-[17px] tracking-tight transition-colors hover:text-[color:var(--v1-terracotta)] " +
                  (isActive
                    ? "text-[color:var(--v1-ink)] underline decoration-[color:var(--v1-terracotta)] decoration-1 underline-offset-[6px]"
                    : "text-[color:var(--v1-ink-mute)]")
                }
              >
                {p.displayName ?? p.name}
              </button>
            );
          })}
        </div>

        {participantId && scans === undefined && (
          <p className="v1-display-italic text-[15px] text-[color:var(--v1-ink-mute)] py-8">
            Loading scans…
          </p>
        )}

        {scans && scans.length === 0 && (
          <p className="v1-display-italic text-[15px] text-[color:var(--v1-ink-mute)] py-8">
            No DEXA scans on record yet.
          </p>
        )}

        {scans && scans.length > 0 && (
          <>
            <p className="text-[14px] text-[color:var(--v1-ink-mute)]">
              {scans.length} scan{scans.length === 1 ? "" : "s"} ·{" "}
              {shortDate(scans[0].scanDate)} →{" "}
              {shortDate(scans[scans.length - 1].scanDate)}
              {last && (
                <>
                  {" · "}
                  {METRICS.map((m) => {
                    const d = delta(first?.[m.key], last[m.key]);
                    if (d === null) return null;
                    return (
                      <span key={m.key} className="whitespace-nowrap">
                        {m.label}{" "}
                        <span
                          className={
                            "tabular-nums " +
                            (d === 0 ? "" : "font-medium text-[color:var(--v1-ink)]")
                          }
                        >
                          {d > 0 ? "+" : ""}
                          {d}
                          {m.unit}
                        </span>{" "}
                      </span>
                    );
                  })}
                </>
              )}
            </p>

            <div className="grid gap-8 sm:grid-cols-2">
              {METRICS.map((metric) => (
                <MetricChart
                  key={metric.key}
                  metric={metric.key}
                  label={metric.label}
                  unit={metric.unit}
                  color={color}
                  scans={scans}
                />
              ))}
            </div>
          </>
        )}

        <p className="text-[12px] text-[color:var(--v1-ink-mute)]">
          <Link href="/" className="underline">
            ← Back to the dashboard
          </Link>
        </p>
      </main>
    </div>
  );
}

function MetricChart({
  metric,
  label,
  unit,
  color,
  scans,
}: {
  metric: MetricKey;
  label: string;
  unit: string;
  color: string;
  scans: Array<{ scanDate: string } & Partial<Record<MetricKey, number>>>;
}) {
  const data = React.useMemo(
    () =>
      scans
        .filter((s) => s[metric] !== undefined)
        .map((s) => ({ date: shortDate(s.scanDate), value: s[metric] })),
    [scans, metric]
  );

  if (data.length === 0) {
    return (
      <section className="space-y-2">
        <h2 className="v1-display text-[20px] font-medium">{label}</h2>
        <div className="v1-rule" />
        <p className="v1-display-italic text-[14px] text-[color:var(--v1-ink-mute)] py-6">
          No data for this metric.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <h2 className="v1-display text-[20px] font-medium">{label}</h2>
      <div className="v1-rule" />
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <LineChart data={data} margin={{ top: 12, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid
              vertical={false}
              strokeDasharray="2 4"
              stroke="oklch(0.85 0.015 70)"
            />
            <XAxis
              dataKey="date"
              tick={{
                fontSize: 11,
                fill: "oklch(0.52 0.012 50)",
                fontStyle: "italic",
                fontFamily: "var(--font-fraunces)",
              }}
              axisLine={{ stroke: "oklch(0.78 0.02 60)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "oklch(0.52 0.012 50)" }}
              axisLine={false}
              tickLine={false}
              domain={["auto", "auto"]}
              unit={unit === "%" ? "%" : undefined}
            />
            <Tooltip
              formatter={(value) => [`${value} ${unit}`, label]}
              contentStyle={{
                fontSize: 12,
                borderRadius: 4,
                border: "1px solid oklch(0.78 0.02 60)",
                background: "oklch(0.99 0.012 85)",
                fontFamily: "var(--font-inter)",
              }}
              labelStyle={{
                fontFamily: "var(--font-fraunces)",
                fontStyle: "italic",
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.5}
              dot={{ r: 3, strokeWidth: 0 }}
              activeDot={{ r: 4.5 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { FALLBACK_COLOR } from "@/lib/constants";
import type { WeighInRow } from "@/lib/dashboard-data";

export function V1WeighInChart({
  weighIns,
  challengeStartDate,
}: {
  weighIns: WeighInRow[];
  challengeStartDate?: string;
}) {
  const data = React.useMemo(() => {
    const startMs = challengeStartDate
      ? new Date(challengeStartDate + "T00:00:00").getTime()
      : null;
    const byWeek = new Map<number, Record<string, number | string>>();
    for (const w of weighIns) {
      let label: string;
      if (startMs !== null) {
        const d = new Date(startMs + w.weekIndex * 7 * 24 * 60 * 60 * 1000);
        label = `Wk ${w.weekIndex} · ${d.getMonth() + 1}/${d.getDate()}`;
      } else {
        label = `Week ${w.weekIndex}`;
      }
      const row = byWeek.get(w.weekIndex) ?? { week: label };
      row[w.participantName] = w.weightLb;
      byWeek.set(w.weekIndex, row);
    }
    return Array.from(byWeek.entries())
      .sort(([a], [b]) => a - b)
      .map(([, row]) => row);
  }, [weighIns, challengeStartDate]);

  const participants = React.useMemo(() => {
    const set = new Set<string>();
    for (const w of weighIns) set.add(w.participantName);
    return Array.from(set).sort();
  }, [weighIns]);

  const colorByName = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const w of weighIns) {
      if (!m.has(w.participantName)) {
        m.set(w.participantName, w.participantColor ?? FALLBACK_COLOR);
      }
    }
    return m;
  }, [weighIns]);

  if (weighIns.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="v1-display text-[26px] font-medium">Weekly weigh-ins</h2>
        <div className="v1-rule" />
        <p className="v1-display-italic text-[15px] text-[color:var(--v1-ink-mute)] py-8">
          No weigh-ins recorded.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="v1-display text-[26px] font-medium">Weekly weigh-ins</h2>
        <span className="v1-smallcaps">{participants.length} entrants</span>
      </div>
      <div className="v1-rule" />
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <LineChart
            data={data}
            margin={{ top: 16, right: 16, left: -8, bottom: 0 }}
          >
            <CartesianGrid
              vertical={false}
              strokeDasharray="2 4"
              stroke="oklch(0.85 0.015 70)"
            />
            <XAxis
              dataKey="week"
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
              tick={{
                fontSize: 11,
                fill: "oklch(0.52 0.012 50)",
              }}
              axisLine={false}
              tickLine={false}
              domain={["auto", "auto"]}
            />
            <Tooltip
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
            <Legend
              wrapperStyle={{
                fontSize: 12,
                fontStyle: "italic",
                fontFamily: "var(--font-fraunces)",
              }}
            />
            {participants.map((name) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={colorByName.get(name) ?? FALLBACK_COLOR}
                strokeWidth={1.5}
                dot={{ r: 2.5, strokeWidth: 0 }}
                activeDot={{ r: 4 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

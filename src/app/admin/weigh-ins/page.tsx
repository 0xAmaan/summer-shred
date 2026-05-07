"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { Upload } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyError } from "@/lib/utils";
import { Id } from "../../../../convex/_generated/dataModel";

export default function WeighInsPage() {
  const challenges = useQuery(api.challenges.list);
  const upsert = useMutation(api.weeklyWeighIns.upsert);
  const remove = useMutation(api.weeklyWeighIns.remove);

  const [challengeId, setChallengeId] = React.useState<Id<"challenges"> | null>(
    null
  );

  if (!challengeId && challenges && challenges.length > 0) {
    const active =
      challenges.find((c) => c.status === "active") ?? challenges[0];
    setChallengeId(active._id);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 lg:px-10 py-10 space-y-8">
      <header className="space-y-1.5 flex items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="admin-eyebrow">Manage</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Weekly weigh-ins
          </h1>
          <p className="text-[15px] text-muted-foreground">
            Bulk-enter weights for each participant by week. Week 0 and the
            final week are pulled from DEXA scans on the chart automatically —
            entries here for those weeks override the scan if set.
          </p>
        </div>
        <Link
          href="/admin/weigh-ins/import"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[13px] font-medium hover:border-foreground/20 hover:bg-muted/40 transition-colors"
        >
          <Upload className="h-3.5 w-3.5" />
          Import from JSON
        </Link>
      </header>

      {challenges && challenges.length > 0 && (
        <div className="space-y-1.5 max-w-xs">
          <Label className="text-[13px]">Challenge</Label>
          <select
            value={challengeId ?? ""}
            onChange={(e) => setChallengeId(e.target.value as Id<"challenges">)}
            className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-[14px]"
          >
            {challenges.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {challengeId && (
        <WeighInGrid
          challengeId={challengeId}
          onUpsert={(args) => upsert(args)}
          onRemove={(id) => remove({ id })}
        />
      )}
    </div>
  );
}

function WeighInGrid({
  challengeId,
  onUpsert,
  onRemove,
}: {
  challengeId: Id<"challenges">;
  onUpsert: (args: {
    challengeId: Id<"challenges">;
    participantId: Id<"participants">;
    weekIndex: number;
    date: string;
    weightLb: number;
  }) => Promise<unknown>;
  onRemove: (id: Id<"weeklyWeighIns">) => Promise<unknown>;
}) {
  const cps = useQuery(api.challengeParticipants.listByChallenge, {
    challengeId,
  });
  const weighIns = useQuery(api.weeklyWeighIns.listByChallenge, {
    challengeId,
  });
  const challenge = useQuery(api.challenges.list)?.find(
    (c) => c._id === challengeId
  );
  const leaderboard = useQuery(api.challengeParticipants.leaderboard, {
    challengeId,
  });

  const [error, setError] = React.useState<string | null>(null);

  const totalWeeks = React.useMemo(() => {
    if (!challenge) return 5;
    const start = new Date(challenge.startDate + "T00:00:00").getTime();
    const end = new Date(challenge.endDate + "T00:00:00").getTime();
    return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24 * 7)));
  }, [challenge]);

  type WeighInRow = NonNullable<typeof weighIns>[number];
  const weighInMap = React.useMemo(() => {
    const m = new Map<string, Map<number, WeighInRow>>();
    for (const w of weighIns ?? []) {
      const key = String(w.participantId);
      if (!m.has(key)) m.set(key, new Map());
      m.get(key)!.set(w.weekIndex, w);
    }
    return m;
  }, [weighIns]);

  // Build a map of (participantId, weekIndex) → scan-derived weight for
  // weeks 0 and the final week. These show as muted, read-only cells when
  // there's no manual entry.
  const scanWeightMap = React.useMemo(() => {
    const m = new Map<string, Map<number, number>>();
    if (!leaderboard || !challenge) return m;
    const startMs = new Date(challenge.startDate + "T00:00:00").getTime();
    const weekFor = (iso: string) => {
      const d = new Date(iso + "T00:00:00").getTime();
      return Math.max(0, Math.floor((d - startMs) / (7 * 24 * 60 * 60 * 1000)));
    };
    for (const r of leaderboard) {
      const key = String(r.participantId);
      if (!m.has(key)) m.set(key, new Map());
      const inner = m.get(key)!;
      if (r.startScan && typeof r.startScan.totalMassLb === "number") {
        inner.set(weekFor(r.startScan.scanDate), r.startScan.totalMassLb);
      }
      if (r.endScan && typeof r.endScan.totalMassLb === "number") {
        inner.set(weekFor(r.endScan.scanDate), r.endScan.totalMassLb);
      }
    }
    return m;
  }, [leaderboard, challenge]);

  function dateForWeek(weekIndex: number): string {
    if (!challenge) return new Date().toISOString().slice(0, 10);
    const start = new Date(challenge.startDate + "T00:00:00");
    start.setDate(start.getDate() + weekIndex * 7);
    return start.toISOString().slice(0, 10);
  }

  async function handleChange(
    participantId: Id<"participants">,
    weekIndex: number,
    value: string,
    existingId?: Id<"weeklyWeighIns">
  ) {
    setError(null);
    const trimmed = value.trim();
    if (trimmed === "") {
      if (existingId) {
        try {
          await onRemove(existingId);
        } catch (e) {
          setError(friendlyError(e));
        }
      }
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      setError("Invalid number");
      return;
    }
    try {
      await onUpsert({
        challengeId,
        participantId,
        weekIndex,
        date: dateForWeek(weekIndex),
        weightLb: n,
      });
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  if (!cps)
    return (
      <p className="text-[14px] text-muted-foreground">Loading participants…</p>
    );
  if (cps.length === 0) {
    return (
      <p className="text-[14px] text-muted-foreground">
        Add participants to this challenge first.
      </p>
    );
  }

  const weeks = Array.from({ length: totalWeeks + 1 }, (_, i) => i);

  return (
    <section className="admin-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <p className="text-[15px] font-semibold tracking-tight">
          Weight grid
        </p>
        <p className="admin-eyebrow">Tab/blur to save · empty = remove</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2.5 admin-eyebrow text-[11px]">
                Participant
              </th>
              {weeks.map((w) => {
                const d = challenge
                  ? new Date(
                      new Date(challenge.startDate + "T00:00:00").getTime() +
                        w * 7 * 24 * 60 * 60 * 1000
                    )
                  : null;
                const dateLabel = d
                  ? `${d.getMonth() + 1}/${d.getDate()}`
                  : "";
                return (
                  <th
                    key={w}
                    className="text-left px-3 py-2.5 admin-eyebrow text-[11px]"
                  >
                    Wk {w}
                    {dateLabel && (
                      <span className="ml-1 font-normal text-muted-foreground/70 normal-case tracking-normal">
                        · {dateLabel}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {cps.map((cp) => (
              <tr key={cp._id}>
                <td className="px-4 py-2 text-[14px] font-medium">
                  {cp.participant?.name ?? "—"}
                </td>
                {weeks.map((w) => {
                  const existing = weighInMap
                    .get(String(cp.participantId))
                    ?.get(w);
                  const scanWeight = scanWeightMap
                    .get(String(cp.participantId))
                    ?.get(w);
                  // If no manual entry but a DEXA scan covers this week,
                  // show the scan value as a read-only fallback.
                  if (!existing && scanWeight !== undefined) {
                    return (
                      <td key={w} className="px-2 py-1.5">
                        <div
                          className="h-9 w-24 rounded-md border border-dashed border-border bg-muted/30 px-2.5 flex items-center text-[14px] tabular-nums text-muted-foreground italic"
                          title="From DEXA scan — overrides if you type a value"
                        >
                          {scanWeight.toFixed(1)}
                        </div>
                      </td>
                    );
                  }
                  return (
                    <td key={w} className="px-2 py-1.5">
                      <WeightCell
                        externalValue={existing?.weightLb?.toString() ?? ""}
                        onCommit={(v) =>
                          handleChange(
                            cp.participantId,
                            w,
                            v,
                            existing?._id
                          )
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && (
        <p className="px-5 py-3 border-t border-border text-[13px] text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}

// Controlled cell — keeps a local draft so typing isn't fighting with the
// Convex query; resyncs the draft whenever the external value changes
// (e.g. after another path commits a weigh-in).
function WeightCell({
  externalValue,
  onCommit,
}: {
  externalValue: string;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = React.useState(externalValue);
  const [seen, setSeen] = React.useState(externalValue);
  if (seen !== externalValue) {
    setSeen(externalValue);
    setDraft(externalValue);
  }
  return (
    <Input
      type="number"
      step="0.1"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== externalValue) onCommit(draft);
      }}
      className="h-9 w-24 text-[14px] tabular-nums"
    />
  );
}

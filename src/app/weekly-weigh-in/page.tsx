"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { friendlyError } from "@/lib/utils";

export default function WeeklyWeighInPage() {
  const challenge = useQuery(api.challenges.active);
  const cps = useQuery(
    api.challengeParticipants.listByChallenge,
    challenge ? { challengeId: challenge._id } : "skip"
  );
  const weighIns = useQuery(
    api.weeklyWeighIns.listByChallenge,
    challenge ? { challengeId: challenge._id } : "skip"
  );
  const upsert = useMutation(api.weeklyWeighIns.upsert);

  const [participantId, setParticipantId] = React.useState<Id<"participants"> | "">("");
  const [weight, setWeight] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmedName, setConfirmedName] = React.useState<string | null>(null);

  // Local-time date helpers — toISOString() shifts to UTC and would mis-bucket
  // late-evening submissions in non-UTC timezones.
  const localIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const now = React.useMemo(() => new Date(), []);
  const todayIso = localIso(now);

  // Form is open Fri/Sat/Sun in the user's local time.
  const dow = now.getDay(); // 0=Sun .. 6=Sat
  const isOpen = dow === 5 || dow === 6 || dow === 0;

  // Current Fri→Mon window. Used to gate "one log per weekend" regardless of
  // how challenge weekIndex aligns to the calendar week.
  const windowStartIso = React.useMemo(() => {
    const back = dow === 5 ? 0 : dow === 6 ? 1 : dow === 0 ? 2 : null;
    if (back == null) return null;
    const d = new Date(now);
    d.setDate(now.getDate() - back);
    return localIso(d);
  }, [now, dow]);
  const windowEndIso = React.useMemo(() => {
    if (!windowStartIso) return null;
    const d = new Date(windowStartIso + "T00:00:00");
    d.setDate(d.getDate() + 3); // Fri + 3 = Mon (exclusive)
    return localIso(d);
  }, [windowStartIso]);

  const daysUntilFriday = (5 - dow + 7) % 7 || 7;
  const nextFriday = new Date(now);
  nextFriday.setDate(now.getDate() + daysUntilFriday);
  const nextFridayLabel = nextFriday.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const currentWeekIndex = React.useMemo(() => {
    if (!challenge) return null;
    const startMs = new Date(challenge.startDate + "T00:00:00").getTime();
    const todayMs = new Date(todayIso + "T00:00:00").getTime();
    return Math.max(0, Math.floor((todayMs - startMs) / (7 * 24 * 60 * 60 * 1000)));
  }, [challenge, todayIso]);

  const challengeEnded = React.useMemo(() => {
    if (!challenge) return false;
    if (challenge.status === "completed") return true;
    return todayIso > challenge.endDate;
  }, [challenge, todayIso]);

  // A participant is hidden from the dropdown if they already have ANY
  // weigh-in row dated within the current Fri→Sun window, including ones
  // entered through the admin grid. This decouples "one log per weekend"
  // from the storage weekIndex, which is anchored to challenge.startDate.
  const submittedThisWindow = React.useMemo(() => {
    const set = new Set<string>();
    if (!windowStartIso || !windowEndIso) return set;
    for (const w of weighIns ?? []) {
      if (w.date >= windowStartIso && w.date < windowEndIso) {
        set.add(String(w.participantId));
      }
    }
    return set;
  }, [weighIns, windowStartIso, windowEndIso]);

  const remaining = React.useMemo(() => {
    if (!cps) return [];
    return cps
      .filter(
        (cp) =>
          cp.participant && !submittedThisWindow.has(String(cp.participantId))
      )
      .sort((a, b) =>
        (a.participant!.name ?? "").localeCompare(b.participant!.name ?? "")
      );
  }, [cps, submittedThisWindow]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!challenge || currentWeekIndex == null || !participantId) return;
    const n = Number(weight.trim());
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter a valid weight in lbs.");
      return;
    }
    const chosen = cps?.find((cp) => cp.participantId === participantId);
    const name =
      chosen?.participant?.displayName ?? chosen?.participant?.name ?? "you";
    setSubmitting(true);
    try {
      await upsert({
        challengeId: challenge._id,
        participantId,
        weekIndex: currentWeekIndex,
        date: todayIso,
        weightLb: n,
      });
      setConfirmedName(name);
      setParticipantId("");
      setWeight("");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-6 py-12 space-y-6">
      <header className="space-y-1.5">
        <p className="admin-eyebrow">Weekly weigh-in</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Log your weight
        </h1>
        {challenge ? (
          <p className="text-[14px] text-muted-foreground">
            {challenge.name}
            {currentWeekIndex != null && !challengeEnded && (
              <> · Week {currentWeekIndex} · {todayIso}</>
            )}
          </p>
        ) : (
          <p className="text-[14px] text-muted-foreground">Loading…</p>
        )}
      </header>

      {challenge === null && (
        <p className="text-[14px] text-muted-foreground">
          No active challenge yet.
        </p>
      )}

      {challenge && challengeEnded && (
        <p className="text-[14px] text-muted-foreground">
          This challenge has ended. Thanks for playing!
        </p>
      )}

      {challenge && !challengeEnded && !isOpen && (
        <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-[14px] text-muted-foreground">
          Weigh-ins are open <span className="font-medium">Fri–Sun</span>. Come
          back {nextFridayLabel}.
        </div>
      )}

      {challenge && !challengeEnded && isOpen && cps && weighIns && currentWeekIndex != null && (
        <>
          {confirmedName && (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[13px]">
              Logged for {confirmedName} — thanks!
            </div>
          )}

          {remaining.length === 0 ? (
            <p className="text-[14px] text-muted-foreground">
              Everyone&apos;s in for this weekend. See you {nextFridayLabel}.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 admin-card p-5">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Your name</Label>
                <select
                  value={participantId}
                  onChange={(e) =>
                    setParticipantId(e.target.value as Id<"participants">)
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-[14px]"
                  required
                >
                  <option value="" disabled>
                    Pick your name…
                  </option>
                  {remaining.map((cp) => (
                    <option key={cp._id} value={cp.participantId}>
                      {cp.participant!.displayName ?? cp.participant!.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[13px]">Weight (lb)</Label>
                <Input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  placeholder="e.g. 168.4"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  required
                />
              </div>

              {error && (
                <p className="text-[13px] text-destructive">{error}</p>
              )}

              <Button
                type="submit"
                disabled={!participantId || !weight || submitting}
                className="w-full"
              >
                {submitting ? "Logging…" : "Log weigh-in"}
              </Button>
            </form>
          )}
        </>
      )}

      {challenge && (
        <p className="text-[12px] text-muted-foreground">
          <Link href={`/${challenge.slug}`} className="underline">
            ← Back to {challenge.name}
          </Link>
        </p>
      )}
    </main>
  );
}

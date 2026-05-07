"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { Save, AlertCircle, UserMinus, UserPlus } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { friendlyError, cn } from "@/lib/utils";
import { Id } from "../../../convex/_generated/dataModel";

type Challenge = {
  _id: Id<"challenges">;
  slug: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "upcoming" | "active" | "completed";
};

export function ChallengeParticipantsPanel() {
  const challenges = useQuery(api.challenges.list);

  if (challenges === undefined) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (challenges.length === 0) {
    return <p className="text-sm text-muted-foreground">No challenges yet.</p>;
  }

  return (
    <div className="space-y-6">
      {challenges.map((c) => (
        <ChallengeBlock key={c._id} challenge={c as Challenge} />
      ))}
    </div>
  );
}

function dayDelta(a: string, b: string): number {
  const t1 = new Date(a + "T00:00:00").getTime();
  const t2 = new Date(b + "T00:00:00").getTime();
  return Math.round(Math.abs(t1 - t2) / 86_400_000);
}

function closestScanId(
  scans: { _id: Id<"dexaScans">; scanDate: string }[],
  target: string,
  maxDays = 14
): Id<"dexaScans"> | null {
  let best: { id: Id<"dexaScans">; delta: number } | null = null;
  for (const s of scans) {
    const d = dayDelta(s.scanDate, target);
    if (d <= maxDays && (!best || d < best.delta)) {
      best = { id: s._id, delta: d };
    }
  }
  return best?.id ?? null;
}

function ChallengeBlock({ challenge }: { challenge: Challenge }) {
  const rows = useQuery(api.challengeParticipants.listForChallengeWithScans, {
    challengeId: challenge._id,
  });
  const allParticipants = useQuery(api.participants.list);
  const upsert = useMutation(api.challengeParticipants.upsert);
  const removeCp = useMutation(api.challengeParticipants.remove);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [addPick, setAddPick] = React.useState<string>("");
  const [adding, setAdding] = React.useState(false);

  const linkedIds = React.useMemo(
    () => new Set((rows ?? []).map((r) => String(r.participantId))),
    [rows]
  );
  const unlinked = React.useMemo(
    () =>
      (allParticipants ?? []).filter((p) => !linkedIds.has(String(p._id))),
    [allParticipants, linkedIds]
  );

  async function handleAdd() {
    if (!addPick) return;
    setAdding(true);
    setError(null);
    try {
      await upsert({
        challengeId: challenge._id,
        participantId: addPick as Id<"participants">,
      });
      setAddPick("");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setAdding(false);
    }
  }

  // Local edits per challengeParticipant id
  const [edits, setEdits] = React.useState<
    Record<
      string,
      {
        startScanId: Id<"dexaScans"> | null;
        endScanId: Id<"dexaScans"> | null;
      }
    >
  >({});

  function getValue(
    cpId: Id<"challengeParticipants">,
    role: "start" | "end",
    saved: Id<"dexaScans"> | null
  ): Id<"dexaScans"> | null {
    const e = edits[String(cpId)];
    if (e) return role === "start" ? e.startScanId : e.endScanId;
    return saved;
  }

  function setValue(
    cpId: Id<"challengeParticipants">,
    role: "start" | "end",
    val: Id<"dexaScans"> | null,
    other: Id<"dexaScans"> | null
  ) {
    setEdits((prev) => ({
      ...prev,
      [String(cpId)]: {
        startScanId: role === "start" ? val : other,
        endScanId: role === "end" ? val : other,
      },
    }));
  }

  async function handleRemove(
    cpId: Id<"challengeParticipants">,
    participantName: string
  ) {
    if (
      !confirm(
        `Remove ${participantName} from ${challenge.name}? Their scan rows are kept; only the link to this challenge is removed.`
      )
    )
      return;
    setSavingId(String(cpId));
    setError(null);
    try {
      await removeCp({ id: cpId });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSavingId(null);
    }
  }

  async function handleSave(cpId: Id<"challengeParticipants">, participantId: Id<"participants">) {
    const e = edits[String(cpId)];
    if (!e) return;
    setSavingId(String(cpId));
    setError(null);
    try {
      await upsert({
        challengeId: challenge._id,
        participantId,
        startScanId: e.startScanId ?? undefined,
        endScanId: e.endScanId ?? undefined,
      });
      setEdits((prev) => {
        const next = { ...prev };
        delete next[String(cpId)];
        return next;
      });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="rounded-md border border-border">
      <div className="px-3 py-2 border-b border-border bg-muted/30">
        <p className="text-sm font-medium">{challenge.name}</p>
        <p className="text-xs text-muted-foreground">
          {challenge.startDate} → {challenge.endDate} · {challenge.status}
        </p>
      </div>
      {rows === undefined ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">
          No participants linked to this challenge yet.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((r) => {
            const startSuggestion = closestScanId(r.scans, challenge.startDate);
            const endSuggestion = closestScanId(r.scans, challenge.endDate);
            const currentStart = getValue(r.challengeParticipantId, "start", r.startScanId);
            const currentEnd = getValue(r.challengeParticipantId, "end", r.endScanId);
            const startMismatch =
              startSuggestion !== null && currentStart !== startSuggestion;
            const endMismatch =
              endSuggestion !== null && currentEnd !== endSuggestion;
            const dirty = Boolean(edits[String(r.challengeParticipantId)]);

            return (
              <div
                key={r.challengeParticipantId}
                className="px-3 py-2.5 flex items-center gap-3 flex-wrap"
              >
                <p className="text-sm font-medium capitalize w-20 shrink-0">
                  {r.participantName}
                </p>
                <ScanSelect
                  label="Start"
                  value={currentStart}
                  scans={r.scans}
                  suggestion={startSuggestion}
                  mismatch={startMismatch}
                  targetDate={challenge.startDate}
                  onChange={(v) =>
                    setValue(r.challengeParticipantId, "start", v, currentEnd)
                  }
                />
                <ScanSelect
                  label="End"
                  value={currentEnd}
                  scans={r.scans}
                  suggestion={endSuggestion}
                  mismatch={endMismatch}
                  targetDate={challenge.endDate}
                  onChange={(v) =>
                    setValue(r.challengeParticipantId, "end", v, currentStart)
                  }
                />
                <Button
                  size="sm"
                  variant={dirty ? "default" : "outline"}
                  disabled={!dirty || savingId === String(r.challengeParticipantId)}
                  onClick={() => handleSave(r.challengeParticipantId, r.participantId)}
                >
                  <Save className="h-3 w-3" />
                  {savingId === String(r.challengeParticipantId) ? "Saving…" : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={savingId === String(r.challengeParticipantId)}
                  onClick={() =>
                    handleRemove(r.challengeParticipantId, r.participantName)
                  }
                  title={`Remove ${r.participantName} from ${challenge.name}`}
                >
                  <UserMinus className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
      {unlinked.length > 0 && (
        <div className="px-3 py-2.5 border-t border-border bg-muted/20 flex items-center gap-2 flex-wrap">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Add participant
          </label>
          <select
            value={addPick}
            onChange={(e) => setAddPick(e.target.value)}
            disabled={adding}
            className="h-8 rounded border border-input bg-background px-2 text-xs"
          >
            <option value="">— pick —</option>
            {unlinked.map((p) => (
              <option key={p._id} value={String(p._id)} className="capitalize">
                {p.name}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={handleAdd} disabled={!addPick || adding}>
            <UserPlus className="h-3 w-3" />
            {adding ? "Adding…" : "Add to challenge"}
          </Button>
        </div>
      )}
      {error && (
        <p className="px-3 py-2 text-sm text-destructive border-t border-border">
          {error}
        </p>
      )}
    </div>
  );
}

function ScanSelect({
  label,
  value,
  scans,
  suggestion,
  mismatch,
  targetDate,
  onChange,
}: {
  label: string;
  value: Id<"dexaScans"> | null;
  scans: {
    _id: Id<"dexaScans">;
    scanDate: string;
    confirmed: boolean;
  }[];
  suggestion: Id<"dexaScans"> | null;
  mismatch: boolean;
  targetDate: string;
  onChange: (v: Id<"dexaScans"> | null) => void;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label} (target {targetDate})
        </label>
        {mismatch && (
          <span title="Doesn't match closest-date suggestion">
            <AlertCircle className="h-3 w-3 text-amber-500" />
          </span>
        )}
      </div>
      <select
        value={value ? String(value) : ""}
        onChange={(e) =>
          onChange(e.target.value ? (e.target.value as Id<"dexaScans">) : null)
        }
        className={cn(
          "h-8 rounded border border-input bg-background px-2 text-xs",
          mismatch && "border-amber-500"
        )}
      >
        <option value="">— none —</option>
        {scans.map((s) => (
          <option key={s._id} value={String(s._id)}>
            {s.scanDate}
            {!s.confirmed && " (unconfirmed)"}
            {suggestion === s._id && " ✓ closest"}
          </option>
        ))}
      </select>
    </div>
  );
}

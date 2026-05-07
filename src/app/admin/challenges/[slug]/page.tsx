"use client";

import * as React from "react";
import { use } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { api } from "../../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScoreFormula } from "@/components/shared/score-formula";
import { friendlyError } from "@/lib/utils";
import {
  type ScoringConfig,
  type ScoringWeights,
  type Tiebreaker,
} from "@/lib/scoring";

const WEIGHT_LABELS: Record<keyof ScoringWeights, string> = {
  fatLossPct: "Fat lost %",
  leanGainPct: "Lean gained %",
  almGainPct: "ALM gained %",
  armsGainPct: "Arms-lean gained %",
  legsGainPct: "Legs-lean gained %",
  leanLossPct: "Lean lost %",
  fatGainPct: "Fat gained %",
  almLossPct: "ALM lost %",
};

// Stable display order for the weights editor — keeps the optional split-ALM
// fields visible even on legacy challenges where the document doesn't yet
// store armsGainPct / legsGainPct.
const WEIGHT_ORDER: (keyof ScoringWeights)[] = [
  "fatLossPct",
  "leanGainPct",
  "almGainPct",
  "armsGainPct",
  "legsGainPct",
  "leanLossPct",
  "fatGainPct",
  "almLossPct",
];

const TIEBREAKER_OPTIONS: { value: Tiebreaker; label: string }[] = [
  { value: "highest_fat_loss_pct", label: "Highest %fat lost" },
  { value: "highest_alm_gain_pct", label: "Highest %ALM gained" },
  { value: "highest_lean_gain_pct", label: "Highest %lean gained" },
];

export default function EditChallengePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const challenge = useQuery(api.challenges.getBySlug, { slug });
  const update = useMutation(api.challenges.update);
  const recompute = useMutation(api.challengeParticipants.recompute);
  const router = useRouter();

  const [draft, setDraft] = React.useState<{
    name: string;
    startDate: string;
    endDate: string;
    status: "upcoming" | "active" | "completed";
    rulesMarkdown: string;
    scoring: ScoringConfig;
    winnerUsd: string;
    builderUsd: string;
  } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [hydratedId, setHydratedId] = React.useState<string | null>(null);

  if (challenge && challenge._id !== hydratedId) {
    setHydratedId(challenge._id);
    setDraft({
      name: challenge.name,
      startDate: challenge.startDate,
      endDate: challenge.endDate,
      status: challenge.status,
      rulesMarkdown: challenge.rulesMarkdown ?? "",
      scoring: challenge.scoring as ScoringConfig,
      winnerUsd: challenge.prizes?.winnerUsd?.toString() ?? "",
      builderUsd: challenge.prizes?.builderUsd?.toString() ?? "",
    });
  }

  if (challenge === undefined) {
    return (
      <div className="p-10 text-[14px] text-muted-foreground">Loading…</div>
    );
  }
  if (challenge === null) {
    return (
      <div className="p-10 space-y-3">
        <p className="text-[15px]">Challenge not found.</p>
        <Button onClick={() => router.push("/admin/challenges")}>Back</Button>
      </div>
    );
  }
  if (!draft) return null;

  function setWeight(key: keyof ScoringWeights, v: string) {
    if (!draft) return;
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    setDraft({
      ...draft,
      scoring: {
        ...draft.scoring,
        weights: { ...draft.scoring.weights, [key]: n },
      },
    });
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const winner = draft.winnerUsd.trim() === "" ? undefined : Number(draft.winnerUsd);
      const builder = draft.builderUsd.trim() === "" ? undefined : Number(draft.builderUsd);
      await update({
        id: challenge!._id,
        name: draft.name,
        startDate: draft.startDate,
        endDate: draft.endDate,
        status: draft.status,
        rulesMarkdown: draft.rulesMarkdown,
        scoring: draft.scoring,
        prizes:
          winner === undefined && builder === undefined
            ? undefined
            : {
                winnerUsd: Number.isFinite(winner) ? winner : undefined,
                builderUsd: Number.isFinite(builder) ? builder : undefined,
              },
      });
      await recompute({ challengeId: challenge!._id });
      setSavedAt(Date.now());
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 lg:px-10 py-10 space-y-8">
      <header className="space-y-3">
        <Link
          href="/admin/challenges"
          className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          All challenges
        </Link>
        <div className="space-y-1.5">
          <p className="admin-eyebrow">Edit challenge</p>
          <h1 className="text-3xl font-semibold tracking-tight">{draft.name}</h1>
          <p className="text-[13px] text-muted-foreground">
            slug:{" "}
            <span className="font-mono text-foreground/80">
              {challenge.slug}
            </span>
          </p>
        </div>
      </header>

      <section className="admin-card overflow-hidden">
        <div className="border-b border-border px-5 py-3.5">
          <p className="text-[15px] font-semibold tracking-tight">Basic info</p>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-[13px]">
              Name
            </Label>
            <Input
              id="name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate" className="text-[13px]">
                Start
              </Label>
              <Input
                id="startDate"
                type="date"
                value={draft.startDate}
                onChange={(e) =>
                  setDraft({ ...draft, startDate: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate" className="text-[13px]">
                End
              </Label>
              <Input
                id="endDate"
                type="date"
                value={draft.endDate}
                onChange={(e) =>
                  setDraft({ ...draft, endDate: e.target.value })
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status" className="text-[13px]">
              Status
            </Label>
            <select
              id="status"
              value={draft.status}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  status: e.target.value as
                    | "upcoming"
                    | "active"
                    | "completed",
                })
              }
              className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-[14px]"
            >
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </section>

      <section className="admin-card overflow-hidden">
        <div className="border-b border-border px-5 py-3.5">
          <p className="text-[15px] font-semibold tracking-tight">Prizes</p>
        </div>
        <div className="px-5 py-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="winnerUsd" className="text-[13px]">
              1st place ($USD)
            </Label>
            <Input
              id="winnerUsd"
              type="number"
              min="0"
              step="1"
              value={draft.winnerUsd}
              onChange={(e) =>
                setDraft({ ...draft, winnerUsd: e.target.value })
              }
              className="tabular-nums"
              placeholder="500"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="builderUsd" className="text-[13px]">
              The Builder ($USD)
            </Label>
            <Input
              id="builderUsd"
              type="number"
              min="0"
              step="1"
              value={draft.builderUsd}
              onChange={(e) =>
                setDraft({ ...draft, builderUsd: e.target.value })
              }
              className="tabular-nums"
              placeholder="100"
            />
          </div>
        </div>
      </section>

      <section className="admin-card overflow-hidden">
        <div className="border-b border-border px-5 py-3.5">
          <p className="text-[15px] font-semibold tracking-tight">
            Scoring weights
          </p>
        </div>
        <div className="px-5 py-5 space-y-5">
          <div className="rounded-md border border-border bg-muted/40 px-4 py-3 overflow-x-auto">
            <ScoreFormula config={draft.scoring} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {WEIGHT_ORDER.map((k) => (
              <div key={k} className="space-y-1.5">
                <Label htmlFor={k} className="text-[13px]">
                  {WEIGHT_LABELS[k]}
                </Label>
                <Input
                  id={k}
                  type="number"
                  step="0.05"
                  value={draft.scoring.weights[k] ?? 0}
                  onChange={(e) => setWeight(k, e.target.value)}
                  className="tabular-nums"
                />
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tiebreaker" className="text-[13px]">
              Tiebreaker
            </Label>
            <select
              id="tiebreaker"
              value={draft.scoring.tiebreaker}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  scoring: {
                    ...draft.scoring,
                    tiebreaker: e.target.value as Tiebreaker,
                  },
                })
              }
              className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-[14px]"
            >
              {TIEBREAKER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="admin-card overflow-hidden">
        <div className="border-b border-border px-5 py-3.5">
          <p className="text-[15px] font-semibold tracking-tight">
            Rules (markdown)
          </p>
        </div>
        <div className="px-5 py-5">
          <Textarea
            rows={14}
            value={draft.rulesMarkdown}
            onChange={(e) =>
              setDraft({ ...draft, rulesMarkdown: e.target.value })
            }
            className="font-mono text-[13px] leading-relaxed"
          />
        </div>
      </section>

      <div className="flex items-center gap-3 sticky bottom-4 admin-card px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/90">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {savedAt && (
          <p className="text-[13px] text-muted-foreground">
            Saved {new Date(savedAt).toLocaleTimeString()}.
          </p>
        )}
        {error && <p className="text-[14px] text-destructive">{error}</p>}
      </div>
    </div>
  );
}

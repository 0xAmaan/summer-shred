"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { ArrowRight } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import { useAdminMutation } from "@/components/admin/admin-auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyError } from "@/lib/utils";

function bumpTrailingNumber(s: string, fallback: string): string {
  const m = s.match(/^(.*?)(\d+)$/);
  if (!m) return fallback;
  return `${m[1]}${Number(m[2]) + 1}`;
}

function dayAfter(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function endOfMonth(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1, 0); // day 0 = last day of previous month
  return d.toISOString().slice(0, 10);
}

/**
 * "End this round, start the next" — clones scoring/rules/prizes from the
 * given challenge, carries the selected roster, and optionally links each
 * participant's end scan as their start scan for the new round.
 */
export function TransitionDialog({ from }: { from: Doc<"challenges"> }) {
  const router = useRouter();
  const transition = useAdminMutation(api.challenges.transition);
  const roster = useQuery(api.challengeParticipants.listByChallenge, {
    challengeId: from._id,
  });

  const [open, setOpen] = React.useState(false);
  const [slug, setSlug] = React.useState("");
  const [name, setName] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [linkScans, setLinkScans] = React.useState(true);
  // null = "not touched yet" → default to everyone who didn't withdraw.
  const [chosen, setChosen] = React.useState<Set<string> | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const defaultSelected = React.useMemo(
    () =>
      new Set(
        (roster ?? [])
          .filter((cp) => cp.participant && !cp.withdrew)
          .map((cp) => String(cp.participantId))
      ),
    [roster]
  );
  const selected = chosen ?? defaultSelected;

  // Prefill everything from the outgoing round whenever the dialog opens.
  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) return;
    setSlug(bumpTrailingNumber(from.slug, `${from.slug}-next`));
    setName(bumpTrailingNumber(from.name, "Next round"));
    const start = dayAfter(from.endDate);
    setStartDate(start);
    setEndDate(endOfMonth(start));
    setLinkScans(true);
    setChosen(null);
    setError(null);
  }

  function toggle(id: string) {
    setChosen(() => {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await transition({
        fromChallengeId: from._id,
        slug: slug.trim(),
        name: name.trim(),
        startDate,
        endDate,
        status: "active",
        participantIds: Array.from(selected) as Id<"participants">[],
        linkEndScansAsStart: linkScans,
      });
      setOpen(false);
      router.push(`/admin/challenges/${result.slug}`);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        Start next round
        <ArrowRight className="h-3.5 w-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start the next round</DialogTitle>
          <DialogDescription>
            Marks <span className="font-medium">{from.name}</span> completed and
            creates the next round with the same scoring, rules, and prizes
            (editable afterwards).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Slug</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Start date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">End date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[13px]">Carry over participants</Label>
            {roster === undefined ? (
              <p className="text-[13px] text-muted-foreground">Loading…</p>
            ) : roster.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                No participants in {from.name}. Add them on the challenge page
                after creating the round.
              </p>
            ) : (
              <ul className="max-h-44 space-y-1.5 overflow-y-auto rounded-md border border-border p-3">
                {roster
                  .filter((cp) => cp.participant)
                  .sort((a, b) =>
                    (a.participant!.name ?? "").localeCompare(b.participant!.name ?? "")
                  )
                  .map((cp) => (
                    <li key={cp._id}>
                      <label className="flex items-center gap-2.5 text-[14px]">
                        <Checkbox
                          checked={selected.has(String(cp.participantId))}
                          onCheckedChange={() => toggle(String(cp.participantId))}
                        />
                        <span>
                          {cp.participant!.displayName ?? cp.participant!.name}
                        </span>
                        {cp.withdrew && (
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            withdrew
                          </span>
                        )}
                      </label>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <label className="flex items-start gap-2.5 text-[14px]">
            <Checkbox
              checked={linkScans}
              onCheckedChange={(checked) => setLinkScans(checked === true)}
              className="mt-0.5"
            />
            <span>
              Use {from.name} end scans as the new round&apos;s start scans
              <span className="block text-[12px] text-muted-foreground">
                Participants without an end scan just start without one.
              </span>
            </span>
          </label>

          {error && <p className="text-[13px] text-destructive">{error}</p>}

          <DialogFooter showCloseButton>
            <Button
              type="submit"
              disabled={submitting || !slug.trim() || !name.trim() || selected.size === 0}
            >
              {submitting ? "Creating…" : `End ${from.name} & start ${name || "next round"}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

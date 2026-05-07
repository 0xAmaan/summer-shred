"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { ChevronRight } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { renderFormula, type ScoringConfig } from "@/lib/scoring";

const STATUS_TONE: Record<string, string> = {
  upcoming: "bg-amber-100 text-amber-800",
  active: "bg-emerald-100 text-emerald-800",
  completed: "bg-neutral-200 text-neutral-700",
};

export default function ChallengesPage() {
  const challenges = useQuery(api.challenges.list);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 lg:px-10 py-10 space-y-8">
      <header className="space-y-1.5">
        <p className="admin-eyebrow">Manage</p>
        <h1 className="text-3xl font-semibold tracking-tight">Challenges</h1>
        <p className="text-[15px] text-muted-foreground">
          Each month is a separate challenge with its own rules and scoring.
        </p>
      </header>

      <section className="admin-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <p className="text-[15px] font-semibold tracking-tight">
            All challenges
          </p>
          <p className="admin-eyebrow">{challenges?.length ?? 0} total</p>
        </div>
        {challenges === undefined ? (
          <p className="px-5 py-6 text-[14px] text-muted-foreground">
            Loading…
          </p>
        ) : challenges.length === 0 ? (
          <p className="px-5 py-6 text-[14px] text-muted-foreground">
            No challenges. Run the seed first.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {challenges.map((c) => (
              <li key={c._id}>
                <Link
                  href={`/admin/challenges/${c.slug}`}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40"
                >
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <p className="text-[15px] font-semibold tracking-tight truncate">
                        {c.name}
                      </p>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATUS_TONE[c.status] ?? "bg-neutral-200 text-neutral-700"}`}
                      >
                        {c.status}
                      </span>
                    </div>
                    <p className="text-[13px] text-muted-foreground tabular-nums">
                      {c.startDate} → {c.endDate}
                    </p>
                    <p className="text-[12px] text-muted-foreground font-mono truncate">
                      {renderFormula(c.scoring as ScoringConfig)}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface RoundTab {
  slug: string;
  name: string;
  round: number;
  status: "upcoming" | "active" | "completed";
  startDate: string;
}

function monthYear(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function V1ChallengeTabs({
  rounds,
  activeRound,
}: {
  rounds: RoundTab[];
  activeRound: number;
}) {
  return (
    <nav className="flex flex-wrap items-center gap-x-7 gap-y-2">
      {[...rounds].reverse().map((r) => {
        const isActive = r.round === activeRound;
        // The currently-active challenge lives at "/", older rounds at "/c{n}".
        const href = r.status === "active" ? "/" : `/c${r.round}`;
        return (
          <Link
            key={r.slug}
            href={href}
            className={cn(
              "v1-display text-[17px] tracking-tight transition-colors hover:text-[color:var(--v1-terracotta)]",
              isActive
                ? "text-[color:var(--v1-ink)] underline decoration-[color:var(--v1-terracotta)] decoration-1 underline-offset-[6px]"
                : "text-[color:var(--v1-ink-mute)]"
            )}
          >
            Round {r.round}{" "}
            <span className="v1-display-italic text-[color:var(--v1-ink-mute)]">
              ({monthYear(r.startDate)})
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

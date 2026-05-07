// Used as a last-resort visual when a participant has no `color` saved in
// the participants table. Manage colors in /admin/participants instead of
// hard-coding them here.
export const FALLBACK_COLOR = "oklch(0.55 0 0)";

export const STATUS_LABELS: Record<string, string> = {
  upcoming: "Upcoming",
  active: "Active",
  completed: "Completed",
};

export const TIEBREAKER_LABELS: Record<string, string> = {
  highest_fat_loss_pct: "Highest %fat lost",
  highest_alm_gain_pct: "Highest %ALM gained",
  highest_lean_gain_pct: "Highest %lean gained",
};

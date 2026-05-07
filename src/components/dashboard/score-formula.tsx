import type { ScoringConfig, ScoringWeights } from "@/lib/scoring";

const TERM_LABEL: Record<keyof ScoringWeights, string> = {
  fatLossPct: "% fat lost",
  leanGainPct: "% lean gained",
  almGainPct: "% ALM gained",
  leanLossPct: "% lean lost",
  fatGainPct: "% fat gained",
  almLossPct: "% ALM lost",
};

interface MetricGroup {
  label: string;
  /** The "good outcome" term — adds to the score. */
  positiveKey: keyof ScoringWeights;
  /** The "bad outcome" term — subtracts. */
  negativeKey: keyof ScoringWeights;
}

const GROUPS: MetricGroup[] = [
  { label: "Fat", positiveKey: "fatLossPct", negativeKey: "fatGainPct" },
  { label: "Lean", positiveKey: "leanGainPct", negativeKey: "leanLossPct" },
  { label: "ALM", positiveKey: "almGainPct", negativeKey: "almLossPct" },
];

function fmtCoef(n: number): string {
  if (n % 1 === 0) return n.toString();
  return n.toFixed(2);
}

function Term({
  sign,
  coef,
  label,
}: {
  sign: "+" | "−";
  coef: number;
  label: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-2 whitespace-nowrap">
      <span
        className="not-italic font-sans text-[22px] text-[color:var(--v1-ink-mute)] leading-none"
        aria-label={sign === "+" ? "plus" : "minus"}
      >
        {sign}
      </span>
      <span className="v1-onum tabular-nums">{fmtCoef(coef)}</span>
      <span className="text-[color:var(--v1-ink-mute)]">·</span>
      <span>{label}</span>
    </span>
  );
}

function OrConnector() {
  return (
    <span
      className="not-italic font-sans text-[11px] uppercase tracking-[0.22em] text-[color:var(--v1-ink-mute)]/70 select-none"
      aria-label="or"
    >
      or
    </span>
  );
}

export function V1ScoreFormula({ config }: { config: ScoringConfig }) {
  const w = config.weights;
  const activeGroups = GROUPS.filter(
    (g) => w[g.positiveKey] !== 0 || w[g.negativeKey] !== 0
  );

  return (
    <div className="space-y-4">
      <p className="v1-display-italic text-[24px] leading-tight text-[color:var(--v1-ink-soft)]">
        Score =
      </p>
      <ul className="space-y-4 pl-2">
        {activeGroups.map((g) => {
          const pw = w[g.positiveKey];
          const nw = w[g.negativeKey];
          const hasPos = pw !== 0;
          const hasNeg = nw !== 0;
          return (
            <li key={g.label} className="grid grid-cols-1 sm:grid-cols-[3rem_1fr] gap-x-5 gap-y-1.5 items-baseline">
              <span className="v1-smallcaps text-[13px] text-[color:var(--v1-ink-mute)]">
                {g.label}
              </span>
              <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 v1-display-italic text-[20px] leading-tight text-[color:var(--v1-ink)]">
                {hasPos && (
                  <Term
                    sign="+"
                    coef={pw}
                    label={TERM_LABEL[g.positiveKey]}
                  />
                )}
                {hasPos && hasNeg && <OrConnector />}
                {hasNeg && (
                  <Term
                    sign="−"
                    coef={nw}
                    label={TERM_LABEL[g.negativeKey]}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="v1-display-italic text-[14px] leading-snug text-[color:var(--v1-ink-mute)] pl-2">
        Each pair contributes only one term per participant — you can&apos;t
        both lose and gain fat in the same scan window.
      </p>
    </div>
  );
}

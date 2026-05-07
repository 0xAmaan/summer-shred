// Pure TS scoring logic — imported by Convex functions and React components
// alike. No Convex types here.

export type Tiebreaker =
  | "highest_fat_loss_pct"
  | "highest_alm_gain_pct"
  | "highest_lean_gain_pct";

export type RequiredMetric =
  | "totalMassLb"
  | "fatMassLb"
  | "leanMassLb"
  | "almLb"
  | "armsLeanLb"
  | "legsLeanLb"
  | "bmd"
  | "bodyFatPct";

export interface ScoringWeights {
  fatLossPct: number;
  leanGainPct: number;
  leanLossPct: number;
  fatGainPct: number;
  almGainPct: number;
  almLossPct: number;
  // Optional split-ALM weights for the gain side. Lets a challenge weight
  // arm vs leg lean gain asymmetrically (e.g. arms 1.0×, legs 0.5×) without
  // affecting the combined ALM loss term. Missing → treated as 0.
  armsGainPct?: number;
  legsGainPct?: number;
}

export interface ScoringConfig {
  weights: ScoringWeights;
  tiebreaker: Tiebreaker;
  requiredMetrics: RequiredMetric[];
}

export interface ScanMetrics {
  totalMassLb?: number;
  fatMassLb?: number;
  leanMassLb?: number;
  almLb?: number;
  armsLeanLb?: number;
  legsLeanLb?: number;
  bmd?: number;
  bodyFatPct?: number;
}

export interface Contribution {
  label: string;
  pct: number;
  coefficient: number;
  signedPoints: number;
}

export interface ScoreBreakdown {
  fatChangeLb: number | null;
  fatChangePct: number | null;
  leanChangeLb: number | null;
  leanChangePct: number | null;
  almChangeLb: number | null;
  almChangePct: number | null;
  armsChangeLb: number | null;
  armsChangePct: number | null;
  legsChangeLb: number | null;
  legsChangePct: number | null;
  contributions: Contribution[];
  missingMetrics: string[];
}

export interface ScoreResult {
  score: number;
  breakdown: ScoreBreakdown;
  tiebreakerValue: number;
  scorable: boolean;
}

const round = (n: number, decimals = 1): number => {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
};

const pctChange = (
  start: number | undefined,
  end: number | undefined
): number | null => {
  if (start === undefined || end === undefined || start === 0) return null;
  return ((end - start) / start) * 100;
};

const lbChange = (
  start: number | undefined,
  end: number | undefined
): number | null => {
  if (start === undefined || end === undefined) return null;
  return end - start;
};

export function computeScore(
  config: ScoringConfig,
  start: ScanMetrics | null | undefined,
  end: ScanMetrics | null | undefined
): ScoreResult {
  const empty: ScoreBreakdown = {
    fatChangeLb: null,
    fatChangePct: null,
    leanChangeLb: null,
    leanChangePct: null,
    almChangeLb: null,
    almChangePct: null,
    armsChangeLb: null,
    armsChangePct: null,
    legsChangeLb: null,
    legsChangePct: null,
    contributions: [],
    missingMetrics: [],
  };

  if (!start || !end) {
    return {
      score: 0,
      tiebreakerValue: 0,
      scorable: false,
      breakdown: { ...empty, missingMetrics: !start ? ["start scan"] : ["end scan"] },
    };
  }

  const missing: string[] = [];
  for (const m of config.requiredMetrics) {
    if (start[m] === undefined || end[m] === undefined) missing.push(m);
  }

  const fatChangePct = pctChange(start.fatMassLb, end.fatMassLb);
  const fatChangeLb = lbChange(start.fatMassLb, end.fatMassLb);
  const leanChangePct = pctChange(start.leanMassLb, end.leanMassLb);
  const leanChangeLb = lbChange(start.leanMassLb, end.leanMassLb);
  const almChangePct = pctChange(start.almLb, end.almLb);
  const almChangeLb = lbChange(start.almLb, end.almLb);
  const armsChangePct = pctChange(start.armsLeanLb, end.armsLeanLb);
  const armsChangeLb = lbChange(start.armsLeanLb, end.armsLeanLb);
  const legsChangePct = pctChange(start.legsLeanLb, end.legsLeanLb);
  const legsChangeLb = lbChange(start.legsLeanLb, end.legsLeanLb);

  const contributions: Contribution[] = [];
  const w = config.weights;
  const armsGainCoef = w.armsGainPct ?? 0;
  const legsGainCoef = w.legsGainPct ?? 0;

  // Fat: positive change is bad (fatGain), negative is good (fatLoss).
  if (fatChangePct !== null) {
    if (fatChangePct < 0 && w.fatLossPct !== 0) {
      const lostPct = Math.abs(fatChangePct);
      contributions.push({
        label: "%FatLost",
        pct: lostPct,
        coefficient: w.fatLossPct,
        signedPoints: lostPct * w.fatLossPct,
      });
    } else if (fatChangePct > 0 && w.fatGainPct !== 0) {
      contributions.push({
        label: "%FatGained",
        pct: fatChangePct,
        coefficient: w.fatGainPct,
        signedPoints: -fatChangePct * w.fatGainPct,
      });
    }
  }

  // Total lean: positive is good (leanGain).
  if (leanChangePct !== null) {
    if (leanChangePct > 0 && w.leanGainPct !== 0) {
      contributions.push({
        label: "%LeanGained",
        pct: leanChangePct,
        coefficient: w.leanGainPct,
        signedPoints: leanChangePct * w.leanGainPct,
      });
    } else if (leanChangePct < 0 && w.leanLossPct !== 0) {
      const lostPct = Math.abs(leanChangePct);
      contributions.push({
        label: "%LeanLost",
        pct: lostPct,
        coefficient: w.leanLossPct,
        signedPoints: -lostPct * w.leanLossPct,
      });
    }
  }

  // ALM: positive is good (almGain).
  if (almChangePct !== null) {
    if (almChangePct > 0 && w.almGainPct !== 0) {
      contributions.push({
        label: "%ALMGained",
        pct: almChangePct,
        coefficient: w.almGainPct,
        signedPoints: almChangePct * w.almGainPct,
      });
    } else if (almChangePct < 0 && w.almLossPct !== 0) {
      const lostPct = Math.abs(almChangePct);
      contributions.push({
        label: "%ALMLost",
        pct: lostPct,
        coefficient: w.almLossPct,
        signedPoints: -lostPct * w.almLossPct,
      });
    }
  }

  // Arms-only lean gain (split-ALM weighting). Loss side stays bundled
  // under almLossPct.
  if (armsChangePct !== null && armsChangePct > 0 && armsGainCoef !== 0) {
    contributions.push({
      label: "%ArmsGained",
      pct: armsChangePct,
      coefficient: armsGainCoef,
      signedPoints: armsChangePct * armsGainCoef,
    });
  }

  // Legs-only lean gain.
  if (legsChangePct !== null && legsChangePct > 0 && legsGainCoef !== 0) {
    contributions.push({
      label: "%LegsGained",
      pct: legsChangePct,
      coefficient: legsGainCoef,
      signedPoints: legsChangePct * legsGainCoef,
    });
  }

  const rawScore = contributions.reduce((s, c) => s + c.signedPoints, 0);
  // `+ 0` normalizes -0 → +0 so the score never serializes as Convex's
  // negative-zero special-float encoding.
  const score = round(rawScore, 1) + 0;

  let tiebreakerValue = 0;
  switch (config.tiebreaker) {
    case "highest_fat_loss_pct":
      tiebreakerValue = fatChangePct !== null ? -fatChangePct : 0;
      break;
    case "highest_alm_gain_pct":
      tiebreakerValue = almChangePct ?? 0;
      break;
    case "highest_lean_gain_pct":
      tiebreakerValue = leanChangePct ?? 0;
      break;
  }

  return {
    score,
    tiebreakerValue,
    scorable: missing.length === 0,
    breakdown: {
      fatChangeLb: fatChangeLb !== null ? round(fatChangeLb, 2) : null,
      fatChangePct: fatChangePct !== null ? round(fatChangePct, 2) : null,
      leanChangeLb: leanChangeLb !== null ? round(leanChangeLb, 2) : null,
      leanChangePct: leanChangePct !== null ? round(leanChangePct, 2) : null,
      almChangeLb: almChangeLb !== null ? round(almChangeLb, 2) : null,
      almChangePct: almChangePct !== null ? round(almChangePct, 2) : null,
      armsChangeLb: armsChangeLb !== null ? round(armsChangeLb, 2) : null,
      armsChangePct: armsChangePct !== null ? round(armsChangePct, 2) : null,
      legsChangeLb: legsChangeLb !== null ? round(legsChangeLb, 2) : null,
      legsChangePct: legsChangePct !== null ? round(legsChangePct, 2) : null,
      contributions,
      missingMetrics: missing,
    },
  };
}

const FORMULA_LABELS: Record<keyof ScoringWeights, string> = {
  fatLossPct: "%FatLost",
  leanGainPct: "%LeanGained",
  leanLossPct: "%LeanLost",
  fatGainPct: "%FatGained",
  almGainPct: "%ALMGained",
  almLossPct: "%ALMLost",
  armsGainPct: "%ArmsGained",
  legsGainPct: "%LegsGained",
};

const FORMULA_SIGN: Record<keyof ScoringWeights, "+" | "-"> = {
  fatLossPct: "+",
  leanGainPct: "+",
  almGainPct: "+",
  armsGainPct: "+",
  legsGainPct: "+",
  leanLossPct: "-",
  fatGainPct: "-",
  almLossPct: "-",
};

export function renderFormula(config: ScoringConfig): string {
  const order: (keyof ScoringWeights)[] = [
    "fatLossPct",
    "leanGainPct",
    "almGainPct",
    "armsGainPct",
    "legsGainPct",
    "leanLossPct",
    "fatGainPct",
    "almLossPct",
  ];
  const terms = order
    .filter((k) => (config.weights[k] ?? 0) !== 0)
    .map((k, i) => {
      const sign = FORMULA_SIGN[k];
      const coef = config.weights[k]!;
      const label = FORMULA_LABELS[k];
      const prefix = i === 0 ? (sign === "-" ? "−" : "") : sign === "+" ? " + " : " − ";
      return `${prefix}${coef}·${label}`;
    });
  return `Score = ${terms.join("") || "0"}`;
}

export interface RankableRow {
  score: number;
  tiebreakerValue: number;
  scorable: boolean;
}

export function rankParticipants<T extends RankableRow>(
  rows: T[]
): (T & { rank: number | null })[] {
  const scorable = rows.filter((r) => r.scorable);
  const unscorable = rows.filter((r) => !r.scorable);
  scorable.sort(
    (a, b) => b.score - a.score || b.tiebreakerValue - a.tiebreakerValue
  );
  const ranked = scorable.map((r, i) => ({ ...r, rank: i + 1 }));
  const unranked = unscorable.map((r) => ({ ...r, rank: null }));
  return [...ranked, ...unranked];
}

// "The Builder" is a side prize awarded to whoever gained the most muscle
// (or lost the least, if everyone lost). The metric depends on the challenge:
// rounds that score lean mass directly use lean; rounds that score ALM use ALM.
export type BuilderMode = "lean" | "alm";

export function pickBuilderMode(scoring: ScoringConfig): BuilderMode | null {
  const w = scoring.weights;
  if (
    w.almGainPct !== 0 ||
    w.almLossPct !== 0 ||
    (w.armsGainPct ?? 0) !== 0 ||
    (w.legsGainPct ?? 0) !== 0
  ) {
    return "alm";
  }
  if (w.leanGainPct !== 0 || w.leanLossPct !== 0) return "lean";
  return null;
}

export function pickBuilder<
  T extends { breakdown: ScoreBreakdown; scorable: boolean }
>(rows: T[], mode: BuilderMode): { winner: T; changePct: number } | null {
  let best: { winner: T; changePct: number } | null = null;
  for (const r of rows) {
    if (!r.scorable) continue;
    const pct =
      mode === "alm" ? r.breakdown.almChangePct : r.breakdown.leanChangePct;
    if (pct === null) continue;
    if (best === null || pct > best.changePct) {
      best = { winner: r, changePct: pct };
    }
  }
  return best;
}

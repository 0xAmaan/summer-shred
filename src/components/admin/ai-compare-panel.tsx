"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import { Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { friendlyError, cn } from "@/lib/utils";
import { Id } from "../../../convex/_generated/dataModel";

interface AiScan {
  scanDate: string;
  totalMassLb: number | null;
  fatMassLb: number | null;
  leanMassLb: number | null;
  armsLeanLb: number | null;
  legsLeanLb: number | null;
  almLb: number | null;
  bmd: number | null;
  bodyFatPct: number | null;
}

interface AiRaw {
  scans?: AiScan[];
  notes?: string;
  participantName?: string;
}

interface ScanCurrent {
  _id: Id<"dexaScans">;
  scanDate: string;
  totalMassLb?: number;
  fatMassLb?: number;
  leanMassLb?: number;
  armsLeanLb?: number;
  legsLeanLb?: number;
  almLb?: number;
  bmd?: number;
  bodyFatPct?: number;
  aiRawResponse?: unknown;
  aiConfidence?: "high" | "medium" | "low";
}

const FIELDS: Array<{
  key: keyof AiScan & keyof ScanCurrent;
  label: string;
  decimals: number;
}> = [
  { key: "totalMassLb", label: "Total mass", decimals: 1 },
  { key: "fatMassLb", label: "Fat mass", decimals: 1 },
  { key: "leanMassLb", label: "Lean mass", decimals: 1 },
  { key: "armsLeanLb", label: "Arms lean", decimals: 1 },
  { key: "legsLeanLb", label: "Legs lean", decimals: 1 },
  { key: "almLb", label: "ALM (arms+legs)", decimals: 1 },
  { key: "bodyFatPct", label: "Body fat %", decimals: 1 },
  { key: "bmd", label: "BMD", decimals: 3 },
];

function fmt(n: number | null | undefined, dec: number): string {
  if (n === null || n === undefined) return "—";
  return n.toFixed(dec);
}

function delta(
  current: number | undefined,
  ai: number | null
): { abs: number; pct: number | null } | null {
  if (current === undefined || ai === null) return null;
  const abs = ai - current;
  const pct = current !== 0 ? (abs / current) * 100 : null;
  return { abs, pct };
}

export function AiComparePanel({
  scan,
  defaultOpen = false,
}: {
  scan: ScanCurrent;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const applyAi = useMutation(api.dexaScans.applyAiToScan);

  const raw = scan.aiRawResponse as AiRaw | undefined;
  const aiScans = raw?.scans ?? [];
  const matching = aiScans.find((s) => s.scanDate === scan.scanDate);
  const otherDates = aiScans
    .filter((s) => s.scanDate !== scan.scanDate)
    .map((s) => s.scanDate);

  if (!matching && aiScans.length === 0) return null;

  async function handleApply() {
    if (!confirm("Overwrite manual values with AI-extracted values for this scan?"))
      return;
    setBusy(true);
    setError(null);
    try {
      await applyAi({ id: scan._id });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleApplyArmsLegs() {
    setBusy(true);
    setError(null);
    try {
      await applyAi({ id: scan._id, fields: ["armsLeanLb", "legsLeanLb"] });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  const matchingHasArmsLegs =
    matching !== undefined &&
    (matching.armsLeanLb !== null || matching.legsLeanLb !== null);

  return (
    <div className="rounded-md border border-border bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2 flex items-center gap-2 text-xs"
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <Sparkles className="h-3 w-3 text-purple-500" />
        <span className="font-medium">AI extraction</span>
        {scan.aiConfidence && (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-medium",
              scan.aiConfidence === "high"
                ? "bg-emerald-100 text-emerald-700"
                : scan.aiConfidence === "low"
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-700"
            )}
          >
            {scan.aiConfidence}
          </span>
        )}
        {!matching && (
          <span className="text-muted-foreground">
            (no match for {scan.scanDate})
          </span>
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {matching ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left font-normal py-1"></th>
                  <th className="text-right font-normal py-1 px-2">Manual</th>
                  <th className="text-right font-normal py-1 px-2">AI</th>
                  <th className="text-right font-normal py-1">Δ</th>
                </tr>
              </thead>
              <tbody>
                {FIELDS.map((f) => {
                  const cur = scan[f.key] as number | undefined;
                  const ai = matching[f.key] as number | null;
                  const d = delta(cur, ai);
                  return (
                    <tr key={f.key} className="border-t border-border/50">
                      <td className="py-1.5 text-muted-foreground">{f.label}</td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {fmt(cur, f.decimals)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {fmt(ai, f.decimals)}
                      </td>
                      <td
                        className={cn(
                          "py-1.5 text-right font-mono tabular-nums",
                          d && Math.abs(d.abs) > Math.pow(10, -f.decimals)
                            ? "text-amber-600"
                            : "text-muted-foreground"
                        )}
                      >
                        {d
                          ? `${d.abs >= 0 ? "+" : ""}${d.abs.toFixed(f.decimals)}${
                              d.pct !== null
                                ? ` (${d.pct >= 0 ? "+" : ""}${d.pct.toFixed(1)}%)`
                                : ""
                            }`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-muted-foreground">
              AI didn&apos;t find a scan dated {scan.scanDate} in this report.
            </p>
          )}

          {otherDates.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              AI also found scans on: {otherDates.join(", ")}
            </p>
          )}

          {raw?.notes && (
            <p className="text-[11px] text-muted-foreground italic">
              {raw.notes}
            </p>
          )}

          {matching && (
            <div className="flex gap-2 pt-1 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={handleApply}
                disabled={busy}
              >
                {busy ? "Applying…" : "Apply AI to all fields"}
              </Button>
              {matchingHasArmsLegs && (
                <Button
                  size="sm"
                  onClick={handleApplyArmsLegs}
                  disabled={busy}
                  title="Backfill arms-lean and legs-lean from AI; ALM auto-derives"
                >
                  {busy ? "Applying…" : "Apply arms/legs only"}
                </Button>
              )}
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}

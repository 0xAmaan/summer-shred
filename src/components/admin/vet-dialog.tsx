"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import { X, Trash2, Save, CheckCircle2, Circle } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AiComparePanel } from "@/components/admin/ai-compare-panel";
import { friendlyError, cn } from "@/lib/utils";
import { Id } from "../../../convex/_generated/dataModel";

interface VetScan {
  _id: Id<"dexaScans">;
  participantId: Id<"participants">;
  scanDate: string;
  totalMassLb?: number;
  fatMassLb?: number;
  leanMassLb?: number;
  armsLeanLb?: number;
  legsLeanLb?: number;
  almLb?: number;
  bmd?: number;
  bodyFatPct?: number;
  confirmed: boolean;
  vettedAt?: number;
  aiRawResponse?: unknown;
  aiConfidence?: "high" | "medium" | "low";
}

type FieldKey =
  | "totalMassLb"
  | "fatMassLb"
  | "leanMassLb"
  | "armsLeanLb"
  | "legsLeanLb"
  | "almLb"
  | "bodyFatPct"
  | "bmd";

const FIELDS: Array<{
  key: FieldKey;
  label: string;
  unit: string;
  decimals: number;
  derived?: boolean;
}> = [
  { key: "totalMassLb", label: "Total mass", unit: "lb", decimals: 1 },
  { key: "fatMassLb", label: "Fat mass", unit: "lb", decimals: 1 },
  { key: "leanMassLb", label: "Lean mass", unit: "lb", decimals: 1 },
  { key: "armsLeanLb", label: "Arms lean", unit: "lb", decimals: 1 },
  { key: "legsLeanLb", label: "Legs lean", unit: "lb", decimals: 1 },
  { key: "almLb", label: "ALM", unit: "lb", decimals: 1, derived: true },
  { key: "bodyFatPct", label: "Body fat", unit: "%", decimals: 1 },
  { key: "bmd", label: "BMD", unit: "g/cm²", decimals: 3 },
];

export function VetDialog({
  open,
  onOpenChange,
  participantName,
  reportUrl,
  scans,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participantName: string;
  reportUrl: string | null;
  scans: VetScan[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!max-w-[97vw] w-[97vw] h-[95vh] flex flex-col p-0 gap-0 overflow-hidden sm:!max-w-[97vw]"
      >
        <DialogHeader className="px-4 py-3 border-b border-border flex-row items-center justify-between space-y-0 shrink-0">
          <DialogTitle className="text-sm capitalize">
            Vet · {participantName}
            <span className="ml-2 text-xs text-muted-foreground font-normal">
              {scans.length} scan{scans.length === 1 ? "" : "s"}
            </span>
          </DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] overflow-hidden">
          <div className="overflow-y-auto border-r border-border">
            <div className="p-4 space-y-4">
              {scans.length === 0 ? (
                <p className="text-sm text-muted-foreground">No scans yet.</p>
              ) : (
                scans.map((scan) => (
                  <VetScanCard key={scan._id} scan={scan} />
                ))
              )}
            </div>
          </div>
          <div className="bg-muted/40">
            {reportUrl ? (
              <iframe
                src={reportUrl}
                title={`${participantName} DEXA report`}
                className="w-full h-full border-0"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                No PDF attached for this participant.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VetScanCard({ scan }: { scan: VetScan }) {
  const updateScan = useMutation(api.dexaScans.update);
  const removeScan = useMutation(api.dexaScans.remove);
  const setVetted = useMutation(api.dexaScans.setVetted);

  const [editMode, setEditMode] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Record<string, string>>({});

  function snapshot() {
    setDraft(
      Object.fromEntries(
        FIELDS.map((f) => [f.key, scan[f.key]?.toString() ?? ""])
      )
    );
  }

  function num(s: string | undefined): number | undefined {
    if (s === undefined || s.trim() === "") return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  }

  async function handleSave() {
    setError(null);
    setBusy(true);
    try {
      const updates: Record<string, number | undefined> = {};
      for (const f of FIELDS) {
        // Skip ALM — backend auto-derives it from arms+legs.
        if (f.derived) continue;
        updates[f.key] = num(draft[f.key]);
      }
      await updateScan({ id: scan._id, ...updates });
      setEditMode(false);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  // Live-derived ALM for display only, while editing.
  const draftArms = num(draft.armsLeanLb);
  const draftLegs = num(draft.legsLeanLb);
  const derivedAlm =
    draftArms !== undefined && draftLegs !== undefined
      ? Math.round((draftArms + draftLegs) * 10) / 10
      : undefined;

  async function handleDelete() {
    if (!confirm(`Delete scan dated ${scan.scanDate}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await removeScan({ id: scan._id });
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  async function handleToggleVetted() {
    setBusy(true);
    setError(null);
    try {
      await setVetted({ id: scan._id, vetted: !scan.vettedAt });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  const isVetted = Boolean(scan.vettedAt);

  return (
    <div
      className={cn(
        "rounded-md border bg-card overflow-hidden transition-colors",
        isVetted ? "border-emerald-500/50" : "border-border"
      )}
    >
      <div
        className={cn(
          "px-3 py-2 flex items-center justify-between border-b",
          isVetted
            ? "border-emerald-500/30 bg-emerald-50/40"
            : "border-border"
        )}
      >
        <div>
          <p className="text-sm font-medium tabular-nums flex items-center gap-1.5">
            {scan.scanDate}
            {isVetted && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wider text-emerald-700"
                title={`Vetted ${new Date(scan.vettedAt!).toLocaleString()}`}
              >
                <CheckCircle2 className="h-3 w-3" />
                Vetted
              </span>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {scan.aiConfidence ? `AI: ${scan.aiConfidence}` : "no AI data"}
            {scan.confirmed ? "" : " · unconfirmed"}
            {isVetted &&
              ` · ${new Date(scan.vettedAt!).toLocaleDateString()}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {editMode ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditMode(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={busy}>
                <Save className="h-3 w-3" />
                {busy ? "Saving…" : "Save"}
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant={isVetted ? "outline" : "default"}
                onClick={handleToggleVetted}
                disabled={busy}
                title={
                  isVetted
                    ? "Click to mark this scan as not yet vetted"
                    : "Mark this scan as verified against the PDF"
                }
              >
                {isVetted ? (
                  <>
                    <Circle className="h-3 w-3" />
                    Un-vet
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    Mark vetted
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  snapshot();
                  setEditMode(true);
                }}
                disabled={busy}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDelete}
                disabled={busy}
                aria-label="Delete scan"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="p-3 space-y-3">
        {editMode ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {FIELDS.map((f) => {
              if (f.derived) {
                return (
                  <div key={f.key} className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {f.label} ({f.unit}) · auto
                    </label>
                    <div className="h-8 px-2 flex items-center text-xs font-mono tabular-nums rounded-md border border-input bg-muted/40 text-muted-foreground">
                      {derivedAlm !== undefined
                        ? derivedAlm.toFixed(f.decimals)
                        : "—"}
                    </div>
                  </div>
                );
              }
              return (
                <div key={f.key} className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {f.label} ({f.unit})
                  </label>
                  <Input
                    type="number"
                    step={f.decimals === 3 ? "0.001" : "0.01"}
                    value={draft[f.key]}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [f.key]: e.target.value }))
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-px overflow-hidden rounded-md bg-border">
            {FIELDS.map((f) => (
              <Stat
                key={f.key}
                label={f.label}
                v={scan[f.key]}
                unit={f.unit === "g/cm²" ? undefined : f.unit}
                dec={f.decimals}
              />
            ))}
          </div>
        )}

        {!isVetted && <AiComparePanel scan={scan} defaultOpen />}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}

function Stat({
  label,
  v,
  unit,
  dec = 1,
}: {
  label: string;
  v?: number;
  unit?: string;
  dec?: number;
}) {
  return (
    <div className={cn("bg-card px-2.5 py-1.5 space-y-0.5")}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="font-mono tabular-nums text-[13px]">
        {v !== undefined ? v.toFixed(dec) : "—"}
        {v !== undefined && unit && (
          <span className="ml-1 text-[10px] text-muted-foreground">{unit}</span>
        )}
      </p>
    </div>
  );
}

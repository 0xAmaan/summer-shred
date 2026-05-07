"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface DexaParseResult {
  participantName: string;
  scanDate: string;
  totalMassLb: number | null;
  fatMassLb: number | null;
  leanMassLb: number | null;
  almLb: number | null;
  bmd: number | null;
  bodyFatPct: number | null;
  confidence: "high" | "medium" | "low";
  notes: string;
  raw: unknown;
}

export interface ParticipantOption {
  id: string;
  name: string;
}

export interface DexaConfirmationValues {
  participantId: string;
  scanDate: string;
  totalMassLb: number | null;
  fatMassLb: number | null;
  leanMassLb: number | null;
  almLb: number | null;
  bmd: number | null;
  bodyFatPct: number | null;
  notes: string;
}

export function DexaConfirmationDialog({
  open,
  onOpenChange,
  parsed,
  participants,
  onConfirm,
  preselectedParticipantId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parsed: DexaParseResult | null;
  participants: ParticipantOption[];
  preselectedParticipantId?: string | null;
  onConfirm: (values: DexaConfirmationValues) => Promise<void>;
}) {
  const [participantId, setParticipantId] = React.useState<string>("");
  const [scanDate, setScanDate] = React.useState("");
  const [fields, setFields] = React.useState({
    totalMassLb: "",
    fatMassLb: "",
    leanMassLb: "",
    almLb: "",
    bmd: "",
    bodyFatPct: "",
    notes: "",
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [newParticipantName, setNewParticipantName] = React.useState("");
  const [hydratedFrom, setHydratedFrom] = React.useState<DexaParseResult | null>(null);

  if (parsed && parsed !== hydratedFrom) {
    setHydratedFrom(parsed);
    setFields({
      totalMassLb: parsed.totalMassLb?.toString() ?? "",
      fatMassLb: parsed.fatMassLb?.toString() ?? "",
      leanMassLb: parsed.leanMassLb?.toString() ?? "",
      almLb: parsed.almLb?.toString() ?? "",
      bmd: parsed.bmd?.toString() ?? "",
      bodyFatPct: parsed.bodyFatPct?.toString() ?? "",
      notes: parsed.notes ?? "",
    });
    setScanDate(parsed.scanDate ?? "");

    if (preselectedParticipantId) {
      setParticipantId(preselectedParticipantId);
    } else if (parsed.participantName) {
      const lower = parsed.participantName.toLowerCase();
      const match = participants.find(
        (p) => p.name.toLowerCase() === lower || lower.includes(p.name.toLowerCase())
      );
      if (match) setParticipantId(match.id);
      else setNewParticipantName(parsed.participantName);
    }
  }

  function num(s: string): number | null {
    if (s.trim() === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  async function handleSubmit() {
    setError(null);
    if (!participantId) {
      setError("Pick a participant.");
      return;
    }
    if (!scanDate) {
      setError("Scan date is required.");
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm({
        participantId,
        scanDate,
        totalMassLb: num(fields.totalMassLb),
        fatMassLb: num(fields.fatMassLb),
        leanMassLb: num(fields.leanMassLb),
        almLb: num(fields.almLb),
        bmd: num(fields.bmd),
        bodyFatPct: num(fields.bodyFatPct),
        notes: fields.notes,
      });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm DEXA scan</DialogTitle>
        </DialogHeader>

        {parsed && (
          <p className="text-xs text-muted-foreground">
            AI detected: <span className="font-medium text-foreground">{parsed.participantName || "—"}</span>{" "}
            · confidence: <span className="font-medium text-foreground">{parsed.confidence}</span>
          </p>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="participant">Participant</Label>
            <select
              id="participant"
              value={participantId}
              onChange={(e) => setParticipantId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring"
            >
              <option value="">— Pick a participant —</option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {newParticipantName && !participantId && (
              <p className="text-xs text-muted-foreground">
                New name detected: <span className="font-medium">{newParticipantName}</span>.{" "}
                Add them on the Participants page first.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="scanDate">Scan date</Label>
            <Input
              id="scanDate"
              type="date"
              value={scanDate}
              onChange={(e) => setScanDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Total mass (lb)"
              value={fields.totalMassLb}
              onChange={(v) => setFields({ ...fields, totalMassLb: v })}
            />
            <Field
              label="Fat mass (lb)"
              value={fields.fatMassLb}
              onChange={(v) => setFields({ ...fields, fatMassLb: v })}
            />
            <Field
              label="Lean mass (lb)"
              value={fields.leanMassLb}
              onChange={(v) => setFields({ ...fields, leanMassLb: v })}
            />
            <Field
              label="ALM (lb)"
              value={fields.almLb}
              onChange={(v) => setFields({ ...fields, almLb: v })}
            />
            <Field
              label="Body fat %"
              value={fields.bodyFatPct}
              onChange={(v) => setFields({ ...fields, bodyFatPct: v })}
            />
            <Field
              label="BMD (g/cm²)"
              value={fields.bmd}
              onChange={(v) => setFields({ ...fields, bmd: v })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={2}
              value={fields.notes}
              onChange={(e) => setFields({ ...fields, notes: e.target.value })}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving…" : "Save scan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

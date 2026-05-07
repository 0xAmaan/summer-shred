"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { Upload, Trash2, Sparkles, Info } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { friendlyError, cn } from "@/lib/utils";

interface ExtractedFile {
  challengeSlug: string;
  challengeStartDate: string;
  challengeEndDate: string;
  totalMessagesScanned: number;
  candidates: ExtractedCandidate[];
}

interface ExtractedCandidate {
  senderHandle: string;
  mappedName: string | null;
  date: string;
  weekIndex: number;
  weightLb: number;
  allCandidates: number[];
  originalText: string;
  ambiguous: boolean;
  ambiguityReason?: string;
  skip: boolean;
}

interface RowState {
  include: boolean;
  participantName: string;
  weightLb: string; // string for input editing
}

export default function WeighInsImportPage() {
  const participants = useQuery(api.participants.list);
  const challenges = useQuery(api.challenges.list);
  const bulkImport = useMutation(api.weeklyWeighIns.bulkImport);

  const [parsed, setParsed] = React.useState<ExtractedFile | null>(null);
  const [rows, setRows] = React.useState<RowState[]>([]);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<{
    inserted: number;
    updated: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  const challenge = React.useMemo(() => {
    if (!parsed || !challenges) return null;
    return challenges.find((c) => c.slug === parsed.challengeSlug) ?? null;
  }, [parsed, challenges]);

  function loadJson(text: string) {
    setParseError(null);
    setResult(null);
    try {
      const j = JSON.parse(text) as ExtractedFile;
      if (!j.candidates || !Array.isArray(j.candidates)) {
        throw new Error("Missing 'candidates' array");
      }
      const sorted = [...j.candidates].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.mappedName ?? "").localeCompare(b.mappedName ?? "");
      });
      setParsed({ ...j, candidates: sorted });
      setRows(
        sorted.map((c) => ({
          include: !c.skip,
          participantName: c.mappedName ?? "",
          weightLb: c.weightLb.toString(),
        }))
      );
    } catch (e) {
      setParseError(e instanceof Error ? e.message : String(e));
      setParsed(null);
      setRows([]);
    }
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => loadJson(String(reader.result ?? ""));
    reader.onerror = () => setParseError("Failed to read file");
    reader.readAsText(file);
  }

  function setRowField<K extends keyof RowState>(
    i: number,
    key: K,
    val: RowState[K]
  ) {
    setRows((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [key]: val };
      return next;
    });
  }

  function selectAll(value: boolean) {
    setRows((prev) => prev.map((r) => ({ ...r, include: value })));
  }

  function selectClear() {
    setRows((prev) =>
      prev.map((r, i) => ({
        ...r,
        include: !parsed!.candidates[i].ambiguous && Boolean(r.participantName),
      }))
    );
  }

  async function handleSubmit() {
    if (!parsed || !challenge) return;
    setSubmitting(true);
    setResult(null);
    try {
      const entries = rows
        .map((r, i) => ({ row: r, cand: parsed.candidates[i] }))
        .filter(({ row }) => row.include && row.participantName)
        .map(({ row, cand }) => ({
          participantName: row.participantName.toLowerCase(),
          date: cand.date,
          weekIndex: cand.weekIndex,
          weightLb: Number(row.weightLb),
        }))
        .filter((e) => Number.isFinite(e.weightLb));

      const r = await bulkImport({
        challengeSlug: parsed.challengeSlug,
        entries,
      });
      setResult(r);
    } catch (e) {
      setParseError(friendlyError(e));
    } finally {
      setSubmitting(false);
    }
  }

  const includedCount = rows.filter((r) => r.include).length;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 lg:px-10 py-10 space-y-6">
      <header className="space-y-1.5">
        <p className="admin-eyebrow">Manage</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Import weigh-ins
        </h1>
        <p className="text-[15px] text-muted-foreground">
          Drop the JSON produced by{" "}
          <code className="font-mono text-[13px]">
            scripts/imessage-extract.mjs
          </code>{" "}
          and vet the rows before pushing.
        </p>
      </header>

      {!parsed ? (
        <DropZone onFile={handleFile} onPaste={loadJson} />
      ) : (
        <>
          <section className="admin-card p-4 flex items-center gap-4 flex-wrap">
            <div>
              <p className="text-[14px] font-medium">{parsed.challengeSlug}</p>
              <p className="text-[12px] text-muted-foreground">
                {parsed.challengeStartDate} → {parsed.challengeEndDate} ·{" "}
                {parsed.candidates.length} candidates
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => {
                setParsed(null);
                setRows([]);
              }}
            >
              <Trash2 className="h-3 w-3" /> Discard
            </Button>
          </section>

          <p className="text-[13px] text-muted-foreground inline-flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Week 0 and the final week are pulled from DEXA scans automatically
            on the chart — don&apos;t import message candidates for those
            weeks unless you want them to override the scan weight.
          </p>

          <section className="admin-card overflow-hidden">
            <div className="px-4 py-2.5 flex items-center gap-3 border-b border-border bg-muted/20">
              <p className="text-[13px] font-medium">
                {includedCount}/{rows.length} message rows selected
              </p>
              <div className="ml-auto flex items-center gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => selectAll(true)}>
                  All
                </Button>
                <Button size="sm" variant="ghost" onClick={() => selectAll(false)}>
                  None
                </Button>
                <Button size="sm" variant="ghost" onClick={selectClear}>
                  <Sparkles className="h-3 w-3" /> Only clear
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-muted/10 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-2 py-2 w-8"></th>
                    <th className="px-2 py-2 text-left">Date</th>
                    <th className="px-2 py-2 text-right w-12">Wk</th>
                    <th className="px-2 py-2 text-left">Participant</th>
                    <th className="px-2 py-2 text-right">Weight (lb)</th>
                    <th className="px-2 py-2 text-left">Message</th>
                    <th className="px-2 py-2 text-left">Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {parsed.candidates.map((c, i) => {
                    const r = rows[i];
                    const ambig = c.ambiguous;
                    return (
                      <tr
                        key={i}
                        className={cn(
                          r.include
                            ? ambig
                              ? "bg-amber-50/40"
                              : ""
                            : "opacity-50",
                          "hover:bg-muted/20"
                        )}
                      >
                        <td className="px-2 py-1.5 align-top">
                          <Checkbox
                            checked={r.include}
                            onCheckedChange={(v) =>
                              setRowField(i, "include", Boolean(v))
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">
                          {c.date}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums text-right">
                          {c.weekIndex}
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={r.participantName}
                            onChange={(e) =>
                              setRowField(i, "participantName", e.target.value)
                            }
                            className="h-7 rounded border border-input bg-background px-1.5 text-[12px] capitalize"
                          >
                            <option value="">— pick —</option>
                            {participants?.map((p) => (
                              <option key={p._id} value={p.name}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <Input
                            type="number"
                            step="0.1"
                            value={r.weightLb}
                            onChange={(e) =>
                              setRowField(i, "weightLb", e.target.value)
                            }
                            className="h-7 w-20 text-[12px] font-mono tabular-nums text-right"
                          />
                          {c.allCandidates.length > 1 && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              all: {c.allCandidates.join(", ")}
                            </p>
                          )}
                        </td>
                        <td
                          className="px-2 py-1.5 text-[12px] text-muted-foreground max-w-md"
                          title={c.originalText}
                        >
                          <p className="truncate">{c.originalText}</p>
                          <p className="text-[10px] mt-0.5">
                            {c.senderHandle}
                          </p>
                        </td>
                        <td className="px-2 py-1.5 text-[11px] text-amber-700">
                          {c.ambiguityReason ?? ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {parseError && (
            <p className="text-[14px] text-destructive">{parseError}</p>
          )}

          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-muted-foreground">
              Will push{" "}
              <strong className="text-foreground">{includedCount}</strong>{" "}
              message-derived weigh-ins.
            </p>
            <Button
              onClick={handleSubmit}
              disabled={submitting || includedCount === 0}
            >
              <Upload className="h-3.5 w-3.5" />
              {submitting ? "Pushing…" : `Push ${includedCount} weigh-ins`}
            </Button>
          </div>

          {result && (
            <section className="admin-card p-4 space-y-2">
              <p className="text-[14px] font-medium">Import result</p>
              <ul className="text-[13px] text-muted-foreground">
                <li>inserted: {result.inserted}</li>
                <li>updated: {result.updated}</li>
                <li>skipped: {result.skipped}</li>
              </ul>
              {result.errors.length > 0 && (
                <div className="text-[12px] text-destructive">
                  <p className="font-medium">Errors:</p>
                  <ul className="list-disc list-inside">
                    {result.errors.map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function DropZone({
  onFile,
  onPaste,
}: {
  onFile: (f: File) => void;
  onPaste: (text: string) => void;
}) {
  const [dragOver, setDragOver] = React.useState(false);
  const [paste, setPaste] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        className={cn(
          "rounded-md border-2 border-dashed p-8 text-center cursor-pointer transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        )}
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium">
          Drop <code>imessage-extracted.json</code> here, or click to choose
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Output of <code>node scripts/imessage-extract.mjs</code>
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
      </div>

      <details className="text-[13px] text-muted-foreground">
        <summary className="cursor-pointer">…or paste JSON directly</summary>
        <div className="pt-2 space-y-2">
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={6}
            className="w-full h-48 rounded-md border border-input bg-card p-2 text-[12px] font-mono"
            placeholder='{"challengeSlug": "...", "candidates": [...]}'
          />
          <Button size="sm" variant="outline" onClick={() => onPaste(paste)}>
            Load
          </Button>
        </div>
      </details>
    </div>
  );
}

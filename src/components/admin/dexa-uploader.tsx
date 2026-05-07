"use client";

import * as React from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Upload } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { friendlyError } from "@/lib/utils";
import {
  DexaConfirmationDialog,
  type DexaParseResult,
} from "./dexa-confirmation-dialog";
import { Id } from "../../../convex/_generated/dataModel";

export function DexaUploader() {
  const generateUploadUrl = useMutation(api.dexaScans.generateUploadUrl);
  const parsePdf = useAction(api.ai.parseDexaPdf);
  const createScan = useMutation(api.dexaScans.create);
  const attachReport = useMutation(api.participants.attachReport);
  const participants = useQuery(api.participants.list);

  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [parsed, setParsed] = React.useState<DexaParseResult | null>(null);
  const [pendingStorageId, setPendingStorageId] = React.useState<Id<"_storage"> | null>(null);
  const [open, setOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      setStatus("Uploading…");
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/pdf" },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
      const { storageId } = (await res.json()) as { storageId: string };

      setStatus("Parsing with AI…");
      const result = await parsePdf({ storageId: storageId as Id<"_storage"> });

      // Adapt the new multi-scan result to the single-scan shape the
      // confirmation dialog expects: pick the most recent dated scan.
      const sorted = [...result.scans].sort((a, b) =>
        b.scanDate.localeCompare(a.scanDate)
      );
      const latest = sorted[0];
      const adapted: DexaParseResult = {
        participantName: result.participantName,
        confidence: result.confidence,
        notes: result.notes,
        scanDate: latest?.scanDate ?? "",
        totalMassLb: latest?.totalMassLb ?? null,
        fatMassLb: latest?.fatMassLb ?? null,
        leanMassLb: latest?.leanMassLb ?? null,
        almLb: latest?.almLb ?? null,
        bmd: latest?.bmd ?? null,
        bodyFatPct: latest?.bodyFatPct ?? null,
        raw: result.raw,
      };
      setParsed(adapted);
      setPendingStorageId(storageId as Id<"_storage">);
      setStatus(null);
      setOpen(true);
    } catch (e) {
      setError(friendlyError(e));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(values: {
    participantId: string;
    scanDate: string;
    totalMassLb: number | null;
    fatMassLb: number | null;
    leanMassLb: number | null;
    almLb: number | null;
    bmd: number | null;
    bodyFatPct: number | null;
    notes: string;
  }) {
    if (!parsed || !pendingStorageId) return;
    await attachReport({
      id: values.participantId as Id<"participants">,
      storageId: pendingStorageId,
    });
    await createScan({
      participantId: values.participantId as Id<"participants">,
      scanDate: values.scanDate,
      totalMassLb: values.totalMassLb ?? undefined,
      fatMassLb: values.fatMassLb ?? undefined,
      leanMassLb: values.leanMassLb ?? undefined,
      almLb: values.almLb ?? undefined,
      bmd: values.bmd ?? undefined,
      bodyFatPct: values.bodyFatPct ?? undefined,
      aiRawResponse: parsed.raw,
      aiConfidence: parsed.confidence,
      notes: values.notes || undefined,
    });
    setParsed(null);
    setPendingStorageId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const participantOptions =
    participants?.map((p) => ({ id: String(p._id), name: p.name })) ?? [];

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={busy}
        size="lg"
      >
        <Upload className="h-4 w-4" />
        {busy ? "Working…" : "Upload DEXA PDF"}
      </Button>
      {status && <p className="text-sm text-muted-foreground">{status}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <DexaConfirmationDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            // User cancelled — keep storageId in case they want to retry, but
            // for simplicity clear it.
            setParsed(null);
            setPendingStorageId(null);
          }
        }}
        parsed={parsed}
        participants={participantOptions}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

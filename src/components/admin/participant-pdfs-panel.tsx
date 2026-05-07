"use client";

import * as React from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Eye, Trash2, Upload, FileX, Sparkles } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { friendlyError } from "@/lib/utils";
import { Id } from "../../../convex/_generated/dataModel";

export function ParticipantPdfsPanel({
  onPreview,
}: {
  onPreview: (url: string, label: string) => void;
}) {
  const participants = useQuery(api.participants.listWithReports);
  const generateUploadUrl = useMutation(api.participants.generateReportUploadUrl);
  const attachReport = useMutation(api.participants.attachReport);
  const removeReport = useMutation(api.participants.removeReport);
  const parseAndApply = useAction(api.ai.parseAndApplyForParticipant);

  const [busyId, setBusyId] = React.useState<Id<"participants"> | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [reparseSummary, setReparseSummary] = React.useState<
    Record<string, string>
  >({});

  async function handleReplace(id: Id<"participants">, file: File) {
    setError(null);
    setBusyId(id);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/pdf" },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
      const { storageId } = (await res.json()) as { storageId: string };
      await attachReport({ id, storageId: storageId as Id<"_storage"> });
      await parseAndApply({ participantId: id, storageId: storageId as Id<"_storage"> });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleReparse(id: Id<"participants">, storageId: Id<"_storage">) {
    setError(null);
    setBusyId(id);
    setReparseSummary((prev) => ({ ...prev, [String(id)]: "Parsing…" }));
    try {
      const summary = await parseAndApply({ participantId: id, storageId });
      const parts: string[] = [];
      if (summary.created > 0)
        parts.push(`${summary.created} new scan${summary.created === 1 ? "" : "s"}`);
      if (summary.updatedAiOnly > 0)
        parts.push(
          `${summary.updatedAiOnly} AI-only update${summary.updatedAiOnly === 1 ? "" : "s"}`
        );
      if (summary.errors.length > 0)
        parts.push(`${summary.errors.length} error(s)`);
      const msg = parts.length > 0 ? parts.join(" · ") : "No scans found";
      setReparseSummary((prev) => ({ ...prev, [String(id)]: msg }));
    } catch (e) {
      setReparseSummary((prev) => ({
        ...prev,
        [String(id)]: friendlyError(e),
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: Id<"participants">, name: string) {
    if (!confirm(`Delete ${name}'s DEXA report PDF? Their scan rows are kept.`))
      return;
    setError(null);
    setBusyId(id);
    try {
      await removeReport({ id });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusyId(null);
    }
  }

  if (participants === undefined) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="rounded-md border border-border divide-y divide-border">
        {participants.map((p) => (
          <PdfRow
            key={p._id}
            participantId={p._id}
            name={p.name}
            reportUrl={p.reportUrl}
            storageId={p.currentReportStorageId ?? null}
            uploadedAt={p.currentReportUploadedAt}
            busy={busyId === p._id}
            anyBusy={busyId !== null}
            reparseStatus={reparseSummary[String(p._id)] ?? null}
            onView={(url) =>
              onPreview(
                url,
                `${p.name} · current DEXA report${
                  p.currentReportUploadedAt
                    ? ` (uploaded ${new Date(
                        p.currentReportUploadedAt
                      ).toLocaleDateString()})`
                    : ""
                }`
              )
            }
            onReplace={(f) => handleReplace(p._id, f)}
            onReparse={(sid) => handleReparse(p._id, sid)}
            onDelete={() => handleDelete(p._id, p.name)}
          />
        ))}
        {participants.length === 0 && (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            No participants yet.
          </p>
        )}
      </div>
    </div>
  );
}

function PdfRow({
  name,
  reportUrl,
  storageId,
  uploadedAt,
  busy,
  anyBusy,
  reparseStatus,
  onView,
  onReplace,
  onReparse,
  onDelete,
}: {
  participantId: Id<"participants">;
  name: string;
  reportUrl: string | null;
  storageId: Id<"_storage"> | null;
  uploadedAt: number | undefined;
  busy: boolean;
  anyBusy: boolean;
  reparseStatus: string | null;
  onView: (url: string) => void;
  onReplace: (file: File) => void;
  onReparse: (storageId: Id<"_storage">) => void;
  onDelete: () => void;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const hasReport = Boolean(reportUrl);

  return (
    <div className="px-3 py-2.5 flex items-center gap-3">
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onReplace(f);
          if (fileRef.current) fileRef.current.value = "";
        }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium capitalize">{name}</p>
        <p className="text-xs text-muted-foreground">
          {hasReport
            ? uploadedAt
              ? `Uploaded ${new Date(uploadedAt).toLocaleString()}`
              : "PDF attached"
            : "No PDF yet"}
          {reparseStatus && (
            <>
              {" · "}
              <span className="text-foreground">{reparseStatus}</span>
            </>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        {hasReport && reportUrl && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onView(reportUrl)}
            // View doesn't hit AI, so it's safe even while another row is busy.
          >
            <Eye className="h-3 w-3" />
            View
          </Button>
        )}
        {hasReport && storageId && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReparse(storageId)}
            disabled={anyBusy}
            title={
              anyBusy && !busy
                ? "Wait for the current parse to finish"
                : "Re-run AI extraction on this PDF (non-destructive)"
            }
          >
            <Sparkles className="h-3 w-3" />
            {busy ? "Parsing…" : "Re-parse"}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={anyBusy}
        >
          <Upload className="h-3 w-3" />
          {hasReport ? "Replace" : "Upload"}
        </Button>
        {hasReport && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            disabled={anyBusy}
            aria-label="Delete PDF"
          >
            {busy ? (
              <FileX className="h-3 w-3 animate-pulse" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

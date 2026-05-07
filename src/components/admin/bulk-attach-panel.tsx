"use client";

import * as React from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { FileUp, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { friendlyError, cn } from "@/lib/utils";
import { Id } from "../../../convex/_generated/dataModel";

const NAME_ALIASES: Record<string, string> = {};

interface FileEntry {
  id: string;
  file: File;
  slug: string;
  participantId: Id<"participants"> | null;
  newParticipantName: string;
  status: "queued" | "uploading" | "parsing" | "done" | "error";
  message?: string;
}

function slugFromFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.pdf$/, "")
    .trim()
    .replace(/\s+/g, "");
}

export function BulkAttachPanel() {
  const participants = useQuery(api.participants.list);
  const generateUploadUrl = useMutation(api.participants.generateReportUploadUrl);
  const attachReport = useMutation(api.participants.attachReport);
  const createParticipant = useMutation(api.participants.create);
  const parseAndApply = useAction(api.ai.parseAndApplyForParticipant);

  const [entries, setEntries] = React.useState<FileEntry[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [pageError, setPageError] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const participantsByName = React.useMemo(() => {
    const m = new Map<string, Id<"participants">>();
    for (const p of participants ?? []) {
      m.set(p.name.toLowerCase(), p._id);
    }
    return m;
  }, [participants]);

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) =>
      f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    const next: FileEntry[] = arr.map((f) => {
      const slug = slugFromFilename(f.name);
      const resolved = NAME_ALIASES[slug] ?? slug;
      const participantId = participantsByName.get(resolved) ?? null;
      return {
        id: `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file: f,
        slug: resolved,
        participantId,
        newParticipantName: participantId ? "" : resolved,
        status: "queued",
      };
    });
    setEntries((prev) => [...prev, ...next]);
  }

  function updateEntry(id: string, patch: Partial<FileEntry>) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  async function uploadOne(entry: FileEntry) {
    updateEntry(entry.id, { status: "uploading", message: "Uploading…" });

    let participantId = entry.participantId;
    if (!participantId) {
      const name = entry.newParticipantName.trim().toLowerCase();
      if (!name) throw new Error("Name required for new participant");
      participantId = await createParticipant({ name });
    }

    const uploadUrl = await generateUploadUrl();
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": entry.file.type || "application/pdf" },
      body: entry.file,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
    const { storageId } = (await res.json()) as { storageId: string };

    await attachReport({
      id: participantId,
      storageId: storageId as Id<"_storage">,
    });

    updateEntry(entry.id, {
      status: "parsing",
      message: "Parsing with AI…",
      participantId,
    });

    const summary = await parseAndApply({
      participantId,
      storageId: storageId as Id<"_storage">,
    });

    const parts: string[] = [];
    if (summary.created > 0) parts.push(`${summary.created} new scan${summary.created === 1 ? "" : "s"}`);
    if (summary.updatedAiOnly > 0)
      parts.push(`${summary.updatedAiOnly} AI-only update${summary.updatedAiOnly === 1 ? "" : "s"}`);
    if (summary.errors.length > 0) parts.push(`${summary.errors.length} error(s)`);
    const msg = parts.length > 0 ? parts.join(" · ") : "Parsed (no scans found)";

    updateEntry(entry.id, { status: "done", message: msg });
  }

  async function uploadAll() {
    setPageError(null);
    setBusy(true);
    try {
      for (const entry of entries) {
        if (entry.status === "done") continue;
        try {
          await uploadOne(entry);
        } catch (e) {
          updateEntry(entry.id, {
            status: "error",
            message: friendlyError(e),
          });
        }
      }
    } catch (e) {
      setPageError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const queuedCount = entries.filter((e) => e.status === "queued").length;

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-md border-2 border-dashed p-6 text-center cursor-pointer transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        <FileUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium">
          Drop DEXA PDFs here or click to select
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Filenames matched to participants (e.g. <code>alex.pdf</code> → Alex).
          Unknown names will create new participants.
        </p>
      </div>

      {entries.length > 0 && (
        <div className="rounded-md border border-border divide-y divide-border">
          {entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              participantsByName={participantsByName}
              participants={participants ?? []}
              onChangeName={(name) => {
                const lower = name.toLowerCase().trim();
                const matched = participantsByName.get(lower);
                updateEntry(entry.id, {
                  newParticipantName: name,
                  participantId: matched ?? null,
                  slug: lower,
                });
              }}
              onChangeParticipant={(id) =>
                updateEntry(entry.id, {
                  participantId: id,
                  newParticipantName: "",
                })
              }
              onRemove={() => removeEntry(entry.id)}
              disabled={busy}
            />
          ))}
        </div>
      )}

      {pageError && <p className="text-sm text-destructive">{pageError}</p>}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {entries.length === 0
            ? "No files queued."
            : `${entries.length} file${entries.length === 1 ? "" : "s"} · ${queuedCount} queued`}
        </p>
        <div className="flex gap-2">
          {entries.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEntries([])}
              disabled={busy}
            >
              Clear
            </Button>
          )}
          <Button
            size="sm"
            onClick={uploadAll}
            disabled={busy || entries.length === 0 || queuedCount === 0}
          >
            {busy ? "Uploading…" : `Upload ${queuedCount > 0 ? queuedCount : "all"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EntryRow({
  entry,
  participants,
  onChangeName,
  onChangeParticipant,
  onRemove,
  disabled,
}: {
  entry: FileEntry;
  participantsByName: Map<string, Id<"participants">>;
  participants: { _id: Id<"participants">; name: string }[];
  onChangeName: (name: string) => void;
  onChangeParticipant: (id: Id<"participants"> | null) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const isNew = entry.participantId === null;
  return (
    <div className="px-3 py-2.5 flex items-center gap-3">
      <StatusIcon status={entry.status} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-mono truncate">{entry.file.name}</p>
        <div className="mt-1 flex items-center gap-2">
          {isNew ? (
            <>
              <span className="text-[11px] uppercase tracking-wider text-amber-600 font-medium">
                NEW
              </span>
              <Input
                value={entry.newParticipantName}
                onChange={(e) => onChangeName(e.target.value)}
                placeholder="participant name"
                className="h-7 text-xs w-40"
                disabled={disabled}
              />
            </>
          ) : (
            <>
              <span className="text-[11px] uppercase tracking-wider text-emerald-600 font-medium">
                MATCHED
              </span>
              <select
                value={String(entry.participantId)}
                onChange={(e) =>
                  onChangeParticipant(e.target.value as Id<"participants">)
                }
                disabled={disabled}
                className="h-7 rounded border border-input bg-background px-2 text-xs"
              >
                {participants.map((p) => (
                  <option key={p._id} value={String(p._id)}>
                    {p.name}
                  </option>
                ))}
              </select>
            </>
          )}
          {entry.message && (
            <span
              className={cn(
                "text-xs",
                entry.status === "error"
                  ? "text-destructive"
                  : entry.status === "done"
                    ? "text-emerald-700"
                    : "text-muted-foreground"
              )}
            >
              {entry.message}
            </span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        disabled={disabled || entry.status === "uploading" || entry.status === "parsing"}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

function StatusIcon({ status }: { status: FileEntry["status"] }) {
  const cls = "h-4 w-4 shrink-0";
  if (status === "queued") return <FileUp className={cn(cls, "text-muted-foreground")} />;
  if (status === "uploading" || status === "parsing")
    return <Loader2 className={cn(cls, "animate-spin text-primary")} />;
  if (status === "done") return <CheckCircle2 className={cn(cls, "text-emerald-600")} />;
  return <AlertCircle className={cn(cls, "text-destructive")} />;
}


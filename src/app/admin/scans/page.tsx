"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Trash2,
  Link2,
  Eye,
  FileX,
  BookOpenCheck,
  CheckCircle2,
} from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { BulkAttachPanel } from "@/components/admin/bulk-attach-panel";
import { ParticipantPdfsPanel } from "@/components/admin/participant-pdfs-panel";
import { ChallengeParticipantsPanel } from "@/components/admin/challenge-participants-panel";
import { AiComparePanel } from "@/components/admin/ai-compare-panel";
import { VetDialog } from "@/components/admin/vet-dialog";
import {
  ScanPreviewDialog,
  useScanPreview,
} from "@/components/shared/scan-preview-dialog";
import { friendlyError } from "@/lib/utils";
import { Id } from "../../../../convex/_generated/dataModel";

export default function ScansPage() {
  const scans = useQuery(api.dexaScans.list);
  const participants = useQuery(api.participants.listWithReports);
  const challenges = useQuery(api.challenges.list);
  const removeScan = useMutation(api.dexaScans.remove);
  const upsertCp = useMutation(api.challengeParticipants.upsert);
  const { preview, open: openPreview, close: closePreview } = useScanPreview();

  const [error, setError] = React.useState<string | null>(null);
  const [linkingId, setLinkingId] = React.useState<string | null>(null);
  const [vettingParticipantId, setVettingParticipantId] = React.useState<
    string | null
  >(null);

  const participantById = React.useMemo(() => {
    const m = new Map<
      string,
      { name: string; reportUrl: string | null }
    >();
    for (const p of participants ?? [])
      m.set(String(p._id), { name: p.name, reportUrl: p.reportUrl });
    return m;
  }, [participants]);

  const grouped = React.useMemo(() => {
    if (!scans) return null;
    const groups = new Map<string, typeof scans>();
    for (const s of scans) {
      const key = String(s.participantId);
      const arr = groups.get(key) ?? [];
      arr.push(s);
      groups.set(key, arr);
    }
    // Sort scans within each group by date asc
    for (const arr of groups.values()) {
      arr.sort((a, b) => a.scanDate.localeCompare(b.scanDate));
    }
    // Sort groups alphabetically by participant name
    return Array.from(groups.entries()).sort((a, b) => {
      const an = participantById.get(a[0])?.name ?? "";
      const bn = participantById.get(b[0])?.name ?? "";
      return an.localeCompare(bn);
    });
  }, [scans, participantById]);

  async function handleLink(
    scanId: Id<"dexaScans">,
    participantId: Id<"participants">,
    challengeId: Id<"challenges">,
    role: "start" | "end"
  ) {
    setError(null);
    try {
      await upsertCp({
        challengeId,
        participantId,
        startScanId: role === "start" ? scanId : undefined,
        endScanId: role === "end" ? scanId : undefined,
      });
      setLinkingId(null);
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  async function handleRemove(id: Id<"dexaScans">) {
    if (!confirm("Delete this scan? This will unlink it from any challenges."))
      return;
    try {
      await removeScan({ id });
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 lg:px-10 py-10 space-y-8">
      <header className="space-y-1.5">
        <p className="admin-eyebrow">Manage</p>
        <h1 className="text-3xl font-semibold tracking-tight">DEXA scans</h1>
        <p className="text-[15px] text-muted-foreground">
          One PDF per participant — replace as new reports come in. AI extracts
          every dated scan in the report and never overwrites confirmed values
          without explicit click.
        </p>
      </header>

      <section className="admin-card overflow-hidden">
        <div className="border-b border-border px-5 py-3.5">
          <p className="text-[15px] font-semibold tracking-tight">
            Bulk upload PDFs
          </p>
        </div>
        <div className="px-5 py-5">
          <BulkAttachPanel />
        </div>
      </section>

      <section className="admin-card overflow-hidden">
        <div className="border-b border-border px-5 py-3.5">
          <p className="text-[15px] font-semibold tracking-tight">
            Participant reports
          </p>
        </div>
        <div className="px-5 py-5">
          <ParticipantPdfsPanel onPreview={openPreview} />
        </div>
      </section>

      <section className="admin-card overflow-hidden">
        <div className="border-b border-border px-5 py-3.5">
          <p className="text-[15px] font-semibold tracking-tight">
            Challenge linking
          </p>
        </div>
        <div className="px-5 py-5">
          <ChallengeParticipantsPanel />
        </div>
      </section>

      {error && <p className="text-[14px] text-destructive">{error}</p>}

      <section className="admin-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <p className="text-[15px] font-semibold tracking-tight">All scan rows</p>
          <p className="admin-eyebrow">
            {scans?.length ?? 0} scan{scans?.length === 1 ? "" : "s"} ·{" "}
            {grouped?.length ?? 0} participant{grouped?.length === 1 ? "" : "s"}
          </p>
        </div>
        {grouped === null ? (
          <p className="px-5 py-6 text-[14px] text-muted-foreground">Loading…</p>
        ) : grouped.length === 0 ? (
          <p className="px-5 py-6 text-[14px] text-muted-foreground">
            No scans yet.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {grouped.map(([participantIdStr, participantScans]) => {
              const meta = participantById.get(participantIdStr);
              const name = meta?.name ?? "Unknown";
              const reportUrl = meta?.reportUrl ?? null;
              const vettedCount = participantScans.filter((s) => s.vettedAt).length;
              const allVetted =
                participantScans.length > 0 &&
                vettedCount === participantScans.length;
              return (
                <div key={participantIdStr} className="py-1">
                  <div className="px-5 py-3 flex items-center justify-between gap-3 bg-muted/40">
                    <div className="flex items-baseline gap-2">
                      <p className="text-[15px] font-semibold tracking-tight capitalize">
                        {name}
                      </p>
                      <p className="admin-eyebrow text-[11px]">
                        {participantScans.length} scan
                        {participantScans.length === 1 ? "" : "s"}
                      </p>
                      <span
                        className={
                          "inline-flex items-center gap-1 text-[11px] font-medium " +
                          (allVetted
                            ? "text-emerald-700"
                            : vettedCount > 0
                              ? "text-amber-700"
                              : "text-muted-foreground")
                        }
                        title={
                          allVetted
                            ? "All scans vetted"
                            : `${vettedCount} of ${participantScans.length} scans vetted`
                        }
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {vettedCount}/{participantScans.length} vetted
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {reportUrl ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() =>
                              setVettingParticipantId(participantIdStr)
                            }
                            title="Open side-by-side vet view"
                          >
                            <BookOpenCheck className="h-3.5 w-3.5" />
                            Vet
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              openPreview(
                                reportUrl,
                                `${name} · current DEXA report`
                              )
                            }
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View PDF
                          </Button>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                          <FileX className="h-3.5 w-3.5" />
                          No PDF
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="border-b border-border bg-muted/20 text-muted-foreground">
                          <th className="text-left font-normal px-4 py-1.5 admin-eyebrow text-[10px]">
                            Date
                          </th>
                          <th className="text-right font-normal px-2 py-1.5 admin-eyebrow text-[10px]">
                            Total
                          </th>
                          <th className="text-right font-normal px-2 py-1.5 admin-eyebrow text-[10px]">
                            Fat
                          </th>
                          <th className="text-right font-normal px-2 py-1.5 admin-eyebrow text-[10px]">
                            Lean
                          </th>
                          <th className="text-right font-normal px-2 py-1.5 admin-eyebrow text-[10px]">
                            Arms
                          </th>
                          <th className="text-right font-normal px-2 py-1.5 admin-eyebrow text-[10px]">
                            Legs
                          </th>
                          <th className="text-right font-normal px-2 py-1.5 admin-eyebrow text-[10px]">
                            ALM
                          </th>
                          <th className="text-right font-normal px-2 py-1.5 admin-eyebrow text-[10px]">
                            BF%
                          </th>
                          <th className="text-right font-normal px-2 py-1.5 admin-eyebrow text-[10px]">
                            BMD
                          </th>
                          <th className="px-4 py-1.5"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {participantScans.map((s) => {
                          const isLinking = linkingId === String(s._id);
                          const showExtras =
                            isLinking || (!s.vettedAt && hasAiExtras(s));
                          return (
                            <React.Fragment key={s._id}>
                              <tr
                                className={
                                  s.vettedAt
                                    ? "hover:bg-emerald-50/30"
                                    : "hover:bg-muted/30"
                                }
                              >
                                <td className="px-4 py-2 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5 font-medium tabular-nums">
                                    {s.scanDate}
                                    {s.vettedAt && (
                                      <CheckCircle2
                                        className="h-3 w-3 text-emerald-600"
                                        aria-label="Vetted"
                                      />
                                    )}
                                  </div>
                                  {(s.aiConfidence || !s.confirmed) && (
                                    <p className="text-[10px] text-muted-foreground">
                                      {s.aiConfidence && `AI: ${s.aiConfidence}`}
                                      {!s.confirmed && " · unconfirmed"}
                                    </p>
                                  )}
                                </td>
                                <Cell v={s.totalMassLb} unit="lb" />
                                <Cell v={s.fatMassLb} unit="lb" />
                                <Cell v={s.leanMassLb} unit="lb" />
                                <Cell v={s.armsLeanLb} unit="lb" />
                                <Cell v={s.legsLeanLb} unit="lb" />
                                <Cell v={s.almLb} unit="lb" />
                                <Cell v={s.bodyFatPct} unit="%" />
                                <Cell v={s.bmd} dec={3} />
                                <td className="px-3 py-2 whitespace-nowrap text-right">
                                  <div className="inline-flex items-center gap-0.5">
                                    {reportUrl && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          openPreview(
                                            reportUrl,
                                            `${name} · ${s.scanDate}`
                                          )
                                        }
                                        title="View this person's DEXA report"
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        setLinkingId(
                                          isLinking ? null : String(s._id)
                                        )
                                      }
                                      title="Link to a challenge"
                                    >
                                      <Link2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleRemove(s._id)}
                                      title="Delete scan"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                              {showExtras && (
                                <tr>
                                  <td colSpan={10} className="px-4 pb-3">
                                    <div className="space-y-2">
                                      {!s.vettedAt && (
                                        <AiComparePanel scan={s} />
                                      )}
                                      {isLinking && (
                                        <LinkPanel
                                          scanId={s._id}
                                          participantId={s.participantId}
                                          challenges={challenges ?? []}
                                          onLink={handleLink}
                                          onCancel={() => setLinkingId(null)}
                                        />
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ScanPreviewDialog preview={preview} onClose={closePreview} />

      {(() => {
        if (!vettingParticipantId || !grouped) return null;
        const found = grouped.find(([id]) => id === vettingParticipantId);
        const meta = participantById.get(vettingParticipantId);
        if (!found || !meta) return null;
        return (
          <VetDialog
            open={true}
            onOpenChange={(o) => {
              if (!o) setVettingParticipantId(null);
            }}
            participantName={meta.name}
            reportUrl={meta.reportUrl}
            scans={found[1]}
          />
        );
      })()}
    </div>
  );
}

function Cell({
  v,
  unit,
  dec = 1,
}: {
  v?: number;
  unit?: string;
  dec?: number;
}) {
  return (
    <td className="px-2 py-2 text-right whitespace-nowrap font-mono tabular-nums">
      {v !== undefined ? (
        <>
          {v.toFixed(dec)}
          {unit && (
            <span className="ml-0.5 text-[10px] text-muted-foreground">
              {unit}
            </span>
          )}
        </>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </td>
  );
}

function hasAiExtras(scan: { aiRawResponse?: unknown }): boolean {
  const raw = scan.aiRawResponse as
    | { scans?: Array<{ scanDate?: string }> }
    | undefined;
  return Array.isArray(raw?.scans) && raw.scans.length > 0;
}

function LinkPanel({
  scanId,
  participantId,
  challenges,
  onLink,
  onCancel,
}: {
  scanId: Id<"dexaScans">;
  participantId: Id<"participants">;
  challenges: {
    _id: Id<"challenges">;
    name: string;
    slug: string;
    status: string;
  }[];
  onLink: (
    scanId: Id<"dexaScans">,
    participantId: Id<"participants">,
    challengeId: Id<"challenges">,
    role: "start" | "end"
  ) => void;
  onCancel: () => void;
}) {
  const [challengeId, setChallengeId] = React.useState<string>(
    challenges[0] ? String(challenges[0]._id) : ""
  );
  const [role, setRole] = React.useState<"start" | "end">("end");

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 flex items-end gap-3 flex-wrap">
      <div className="space-y-1.5">
        <label className="admin-eyebrow text-[11px]">Challenge</label>
        <select
          value={challengeId}
          onChange={(e) => setChallengeId(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-background px-2.5 text-[14px]"
        >
          {challenges.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label className="admin-eyebrow text-[11px]">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "start" | "end")}
          className="flex h-9 rounded-md border border-input bg-background px-2.5 text-[14px]"
        >
          <option value="start">Start</option>
          <option value="end">End</option>
        </select>
      </div>
      <Button
        size="sm"
        onClick={() =>
          challengeId &&
          onLink(scanId, participantId, challengeId as Id<"challenges">, role)
        }
      >
        Link
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

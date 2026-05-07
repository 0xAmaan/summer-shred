"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import Anthropic from "@anthropic-ai/sdk";

function anthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured on the Convex deployment. Run: npx convex env set ANTHROPIC_API_KEY <your-key>"
    );
  }
  // Bumped from default 2 → 5 so transient 429s (concurrent-connection
  // limit on the Anthropic account) get retried with exponential backoff
  // instead of bubbling to the user.
  return new Anthropic({ apiKey, maxRetries: 5 });
}

const PARSE_DEXA_PROMPT = `You are extracting structured data from a DEXA body composition scan PDF.

DEXA reports typically include the most recent scan PLUS comparison rows for prior dated scans on the same patient. Extract every dated scan you see in the report, not just the most recent.

Return ONLY valid JSON, no markdown fences, matching this exact schema:
{
  "participantName": <string — the patient/client first name on the report; lowercase OK>,
  "confidence":      <"high" | "medium" | "low" — your overall confidence in the extraction>,
  "notes":           <short string — caveats, units assumed, ambiguity>,
  "scans": [
    {
      "scanDate":    <string — ISO YYYY-MM-DD; convert from the report's format>,
      "totalMassLb": <number with 1 decimal, or null>,
      "fatMassLb":   <number with 1 decimal, or null>,
      "leanMassLb":  <number with 1 decimal — TOTAL lean mass, NOT just appendicular>,
      "armsLeanLb":  <number with 1 decimal — TOTAL arms lean (left arm lean + right arm lean), or null>,
      "legsLeanLb":  <number with 1 decimal — TOTAL legs lean (left leg lean + right leg lean), or null>,
      "almLb":       <number with 1 decimal — Appendicular Lean Mass = armsLeanLb + legsLeanLb. Compute and return this even if the report doesn't print it directly.>,
      "bmd":         <number with 3 decimals — total BMD in g/cm^2, or null>,
      "bodyFatPct":  <number with 1 decimal — Body Fat % of total mass>
    }
  ]
}

Rules:
- If the report is in kg, convert to lb (1 kg = 2.20462 lb) and note conversion in "notes".
- ALM is the sum of arms total lean + legs total lean (skeletal muscle in limbs only). If the report shows ALMI (kg/m^2), convert and note.
- Always extract armsLeanLb and legsLeanLb separately — almost every DEXA report breaks them out by limb. almLb should equal their sum.
- If a field is genuinely not present in the report for a given scan, return null for that field.
- Include every dated scan visible in the report (most reports show 2–6 historical entries).
- Each scan object MUST have a scanDate. If a column shows historical data without a date, skip it.
- Order doesn't matter; downstream sorts.
- Never wrap the JSON in markdown fences. Output JUST the JSON object.`;

interface ParsedScan {
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

interface ParseDexaResult {
  participantName: string;
  confidence: "high" | "medium" | "low";
  notes: string;
  scans: ParsedScan[];
  raw: unknown;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

async function runParse(
  ctx: { storage: { get: (id: Id<"_storage">) => Promise<Blob | null> } },
  storageId: Id<"_storage">
): Promise<ParseDexaResult> {
  const blob = await ctx.storage.get(storageId);
  if (!blob) throw new Error("PDF not found in storage");

  const arrayBuffer = await blob.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const client = anthropicClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64,
            },
          },
          { type: "text", text: PARSE_DEXA_PROMPT },
        ],
      },
    ],
  });

  const responseText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  const jsonString = responseText
    .replace(/^```json?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error(
      `Failed to parse Claude response as JSON: ${jsonString.slice(0, 300)}`
    );
  }

  const rawScans = Array.isArray(parsed.scans) ? parsed.scans : [];
  const scans: ParsedScan[] = rawScans
    .map((s) => {
      const obj = s as Record<string, unknown>;
      const scanDate = String(obj.scanDate ?? "").trim();
      if (!scanDate) return null;
      const armsLeanLb = num(obj.armsLeanLb);
      const legsLeanLb = num(obj.legsLeanLb);
      let almLb = num(obj.almLb);
      // If AI didn't return almLb but gave arms+legs, derive it.
      if (almLb === null && armsLeanLb !== null && legsLeanLb !== null) {
        almLb = Math.round((armsLeanLb + legsLeanLb) * 10) / 10;
      }
      return {
        scanDate,
        totalMassLb: num(obj.totalMassLb),
        fatMassLb: num(obj.fatMassLb),
        leanMassLb: num(obj.leanMassLb),
        armsLeanLb,
        legsLeanLb,
        almLb,
        bmd: num(obj.bmd),
        bodyFatPct: num(obj.bodyFatPct),
      };
    })
    .filter((s): s is ParsedScan => s !== null);

  const confidence = ((): "high" | "medium" | "low" => {
    const c = String(parsed.confidence ?? "medium").toLowerCase();
    return c === "high" || c === "low" ? c : "medium";
  })();

  return {
    participantName: String(parsed.participantName ?? "").trim(),
    confidence,
    notes: String(parsed.notes ?? ""),
    scans,
    raw: parsed,
  };
}

export const parseDexaPdf = action({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args): Promise<ParseDexaResult> => {
    return await runParse(ctx, args.storageId);
  },
});

interface ApplySummary {
  participantName: string;
  confidence: "high" | "medium" | "low";
  notes: string;
  created: number;
  updatedAiOnly: number;
  scans: ParsedScan[];
  errors: string[];
}

export const parseAndApplyForParticipant = action({
  args: {
    participantId: v.id("participants"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args): Promise<ApplySummary> => {
    const result = await runParse(ctx, args.storageId);

    let created = 0;
    let updatedAiOnly = 0;
    const errors: string[] = [];

    for (const scan of result.scans) {
      try {
        const r = await ctx.runMutation(api.dexaScans.upsertFromAi, {
          participantId: args.participantId,
          aiScan: scan,
          aiConfidence: result.confidence,
          aiRaw: result.raw,
        });
        if (r.action === "created") created++;
        else updatedAiOnly++;
      } catch (e) {
        errors.push(
          `${scan.scanDate}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }

    return {
      participantName: result.participantName,
      confidence: result.confidence,
      notes: result.notes,
      created,
      updatedAiOnly,
      scans: result.scans,
      errors,
    };
  },
});

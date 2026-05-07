import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("participants").collect();
    return rows
      .map((p) => ({
        ...p,
        avatarUrl: null as string | null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const listWithReports = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("participants").collect();
    const enriched = await Promise.all(
      rows.map(async (p) => ({
        ...p,
        reportUrl: p.currentReportStorageId
          ? await ctx.storage.getUrl(p.currentReportStorageId)
          : null,
      }))
    );
    return enriched.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const get = query({
  args: { id: v.id("participants") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

export const getByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("participants")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    displayName: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("participants")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("participants", {
      name: args.name,
      displayName: args.displayName,
      color: args.color,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("participants"),
    name: v.optional(v.string()),
    displayName: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...rest } = args;
    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) updates[k] = v;
    }
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("participants") },
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.id);
    if (p?.currentReportStorageId) {
      await ctx.storage.delete(p.currentReportStorageId);
    }
    await ctx.db.delete(args.id);
  },
});

export const generateReportUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

export const attachReport = mutation({
  args: {
    id: v.id("participants"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.id);
    if (!p) throw new Error("Participant not found");
    if (p.currentReportStorageId && p.currentReportStorageId !== args.storageId) {
      await ctx.storage.delete(p.currentReportStorageId);
    }
    await ctx.db.patch(args.id, {
      currentReportStorageId: args.storageId,
      currentReportUploadedAt: Date.now(),
    });
  },
});

export const removeReport = mutation({
  args: { id: v.id("participants") },
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.id);
    if (!p) return;
    if (p.currentReportStorageId) {
      await ctx.storage.delete(p.currentReportStorageId);
    }
    await ctx.db.patch(args.id, {
      currentReportStorageId: undefined,
      currentReportUploadedAt: undefined,
    });
  },
});

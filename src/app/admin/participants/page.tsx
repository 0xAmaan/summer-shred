"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { Trash2, Plus } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyError } from "@/lib/utils";
import { FALLBACK_COLOR } from "@/lib/constants";
import { Id } from "../../../../convex/_generated/dataModel";

export default function ParticipantsPage() {
  const participants = useQuery(api.participants.list);
  const create = useMutation(api.participants.create);
  const update = useMutation(api.participants.update);
  const remove = useMutation(api.participants.remove);

  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  async function handleAdd() {
    setError(null);
    if (!name.trim()) {
      setError("Name required.");
      return;
    }
    try {
      await create({ name: name.trim(), color: color.trim() || undefined });
      setName("");
      setColor("");
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 lg:px-10 py-10 space-y-8">
      <header className="space-y-1.5">
        <p className="admin-eyebrow">Manage</p>
        <h1 className="text-3xl font-semibold tracking-tight">Participants</h1>
        <p className="text-[15px] text-muted-foreground">
          Global pool of participants — reused across challenges.
        </p>
      </header>

      <section className="admin-card p-5 space-y-4">
        <p className="text-[15px] font-semibold tracking-tight">
          Add a participant
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-[13px]">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="James"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="color" className="text-[13px]">
              Color (optional)
            </Label>
            <Input
              id="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="oklch(0.6 0.2 200)"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4" />
            Add participant
          </Button>
          {error && (
            <p className="text-[13px] text-destructive">{error}</p>
          )}
        </div>
      </section>

      <section className="admin-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <p className="text-[15px] font-semibold tracking-tight">
            All participants
          </p>
          <p className="admin-eyebrow">{participants?.length ?? 0} total</p>
        </div>
        {participants === undefined ? (
          <p className="px-5 py-6 text-[14px] text-muted-foreground">
            Loading…
          </p>
        ) : participants.length === 0 ? (
          <p className="px-5 py-6 text-[14px] text-muted-foreground">
            No participants yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {participants.map((p) => (
              <ParticipantRow
                key={p._id}
                id={p._id}
                name={p.name}
                color={p.color ?? FALLBACK_COLOR}
                onUpdate={(updates) => update({ id: p._id, ...updates })}
                onRemove={() => remove({ id: p._id })}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ParticipantRow({
  id,
  name,
  color,
  onUpdate,
  onRemove,
}: {
  id: Id<"participants">;
  name: string;
  color: string;
  onUpdate: (updates: { name?: string; color?: string }) => Promise<unknown>;
  onRemove: () => Promise<unknown>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draftName, setDraftName] = React.useState(name);
  const [draftColor, setDraftColor] = React.useState(color);

  async function handleSave() {
    await onUpdate({ name: draftName, color: draftColor });
    setEditing(false);
  }

  async function handleRemove() {
    if (!confirm(`Delete ${name}?`)) return;
    await onRemove();
  }

  return (
    <li className="flex items-center gap-3 px-5 py-3.5">
      <span
        className="h-3.5 w-3.5 rounded-full shrink-0 ring-1 ring-foreground/10"
        style={{ backgroundColor: color }}
      />
      {editing ? (
        <>
          <Input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            className="h-9 flex-1"
          />
          <Input
            value={draftColor}
            onChange={(e) => setDraftColor(e.target.value)}
            className="h-9 w-56 font-mono text-[12px]"
          />
          <Button size="sm" onClick={handleSave}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 text-[14px] font-medium">{name}</span>
          <span className="text-[12px] text-muted-foreground font-mono truncate max-w-[14rem]">
            {color}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={handleRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
      <span className="hidden">{String(id)}</span>
    </li>
  );
}

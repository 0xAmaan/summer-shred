"use client";

import * as React from "react";
import { useAction, useMutation } from "convex/react";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";

const AdminKeyContext = React.createContext<string | null>(null);

/**
 * Fetches the Convex admin API token (admin-cookie gated route) and provides
 * it to useAdminMutation/useAdminAction below. Privileged Convex functions
 * reject calls without it, so admin pages wait for the token before rendering.
 */
export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [key, setKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/token");
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Failed to load admin token");
        if (!cancelled) setKey(body.token);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-[14px] text-destructive">
          {error}
        </div>
      </div>
    );
  }
  if (!key) {
    return (
      <p className="px-6 py-10 text-[14px] text-muted-foreground">Loading…</p>
    );
  }
  return (
    <AdminKeyContext.Provider value={key}>{children}</AdminKeyContext.Provider>
  );
}

export function useAdminKey(): string {
  const key = React.useContext(AdminKeyContext);
  if (!key) {
    throw new Error("useAdminKey must be used inside AdminAuthProvider");
  }
  return key;
}

/** Like useMutation, but injects the admin API token into every call. */
export function useAdminMutation<M extends FunctionReference<"mutation">>(
  ref: M
) {
  const adminKey = useAdminKey();
  const raw = useMutation(ref);
  return React.useCallback(
    (
      args?: Omit<FunctionArgs<M>, "adminKey">
    ): Promise<FunctionReturnType<M>> =>
      raw({ ...(args ?? {}), adminKey } as FunctionArgs<M>),
    [raw, adminKey]
  );
}

/** Like useAction, but injects the admin API token into every call. */
export function useAdminAction<A extends FunctionReference<"action">>(ref: A) {
  const adminKey = useAdminKey();
  const raw = useAction(ref);
  return React.useCallback(
    (
      args?: Omit<FunctionArgs<A>, "adminKey">
    ): Promise<FunctionReturnType<A>> =>
      raw({ ...(args ?? {}), adminKey } as FunctionArgs<A>),
    [raw, adminKey]
  );
}

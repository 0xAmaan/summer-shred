"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { DashboardScreen } from "@/components/dashboard/screen";

export default function ChallengePage({
  params,
}: {
  params: Promise<{ challenge: string }>;
}) {
  const { challenge } = use(params);
  const match = /^c(\d+)$/i.exec(challenge);
  if (!match) {
    notFound();
  }
  const round = Number(match![1]);
  return <DashboardScreen round={round} />;
}

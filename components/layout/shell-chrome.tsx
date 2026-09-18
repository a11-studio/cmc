"use client";

import { useCallback, useEffect, useState } from "react";
import { TopBar } from "@/components/layout/top-bar";
import { ARENA_LIVE_REFRESH_EVENT } from "@/lib/arena/live-events";
import type { MarketTickerQuote } from "@/types/arena";

const PLACEHOLDER_NOW = "2026-01-01T00:00:00.000Z";

type ShellPayload = {
  quotes: MarketTickerQuote[];
  lastCompletedAt?: string | null;
  serverNow: string;
  autoRunCycle?: boolean;
  tradingPaused?: boolean;
};

export function ShellChrome() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/shell", { cache: "no-store" });

    if (!response.ok) {
      return;
    }

    setPayload((await response.json()) as ShellPayload);
  }, []);

  useEffect(() => {
    void load();

    function onRefresh() {
      void load();
    }

    window.addEventListener(ARENA_LIVE_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(ARENA_LIVE_REFRESH_EVENT, onRefresh);
  }, [load]);

  return (
    <TopBar
      quotes={payload?.quotes ?? []}
      lastCompletedAt={payload?.lastCompletedAt}
      serverNow={payload?.serverNow ?? PLACEHOLDER_NOW}
      autoRunCycle={payload?.autoRunCycle}
      tradingPaused={payload?.tradingPaused}
    />
  );
}

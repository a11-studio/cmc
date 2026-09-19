"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ARENA_LIVE_REFRESH_EVENT } from "@/lib/arena/live-events";

// One cycle writes to activity_events, trades, agents and portfolio_snapshots
// together, so watching the last of those is enough to pick all of them up.
const REALTIME_TABLES = ["portfolio_snapshots", "arena_chat_messages"] as const;

// Six agents finish within a few seconds of each other; this collapses that
// burst into a single refresh instead of one per agent.
const REFRESH_DEBOUNCE_MS = 1500;

export function LiveRefresh() {
  const router = useRouter();
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const client = createSupabaseBrowserClient();

    if (!client) {
      return;
    }

    const refresh = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        window.dispatchEvent(new Event(ARENA_LIVE_REFRESH_EVENT));
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    };

    let channel = client.channel("arena-live");

    for (const table of REALTIME_TABLES) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        refresh
      );
    }

    channel.subscribe();

    return () => {
      window.clearTimeout(timer.current);
      void client.removeChannel(channel);
    };
  }, [router]);

  return null;
}

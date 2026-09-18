"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const REALTIME_TABLES = ["activity_events", "portfolio_snapshots", "trades", "agents"] as const;

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
        router.refresh();
      }, 200);
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

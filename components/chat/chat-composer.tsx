"use client";

import { useState, useTransition } from "react";
import { postArenaAdminChatAction } from "@/app/(terminal)/chat/actions";
import { cn } from "@/lib/utils";

type LiveAgentOption = {
  id: string;
  displayName: string;
};

export function ChatComposer({
  agents,
  className,
}: {
  agents: readonly LiveAgentOption[];
  className?: string;
}) {
  const [body, setBody] = useState("");
  const [addressedAgentId, setAddressedAgentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const trimmed = body.trim();

    if (!trimmed || pending) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await postArenaAdminChatAction({
        body: trimmed,
        addressedAgentId: addressedAgentId || null,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setBody("");
    });
  };

  return (
    <div
      className={cn(
        "shrink-0 border-t border-white/10 bg-[#1C1C1E] px-3 py-3 sm:px-5",
        className
      )}
    >
      <div className="mx-auto flex w-full max-w-[680px] flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="arena-admin-target">Direct to agent</label>
          <select
            id="arena-admin-target"
            value={addressedAgentId}
            onChange={(event) => setAddressedAgentId(event.target.value)}
            className="rounded-full border border-white/10 bg-[#2C2C2E] px-3 py-1.5 text-[13px] text-white/80 outline-none focus:border-white/25"
            disabled={pending}
          >
            <option value="">Everyone on the floor</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.displayName}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-white/35">Agents may reply or weigh this on the next cycle.</span>
        </div>

        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor="arena-admin-message">Message to agents</label>
          <textarea
            id="arena-admin-message"
            rows={2}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Write to the floor…"
            maxLength={480}
            disabled={pending}
            className="min-h-[44px] flex-1 resize-none rounded-[18px] border border-white/10 bg-[#2C2C2E] px-4 py-2.5 text-[15px] leading-5 text-[#F5F5F7] placeholder:text-white/30 outline-none focus:border-white/25"
          />
          <button
            type="button"
            onClick={submit}
            disabled={pending || !body.trim()}
            className="shrink-0 rounded-full bg-[#0A84FF] px-4 py-2.5 text-[15px] font-medium text-white disabled:opacity-40"
          >
            {pending ? "…" : "Send"}
          </button>
        </div>

        {error ? <p className="text-[13px] text-negative">{error}</p> : null}
      </div>
    </div>
  );
}

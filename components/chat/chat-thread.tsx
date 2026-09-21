"use client";

import { useLayoutEffect, useRef } from "react";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import { ArenaAdminAvatar } from "@/components/chat/arena-admin-avatar";
import { ARENA_ADMIN_AGENT_ID } from "@/lib/chat/constants";
import { layoutArenaChat } from "@/lib/chat/layout";
import { formatChartTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AgentMark } from "@/types/arena";
import type { ArenaChatMessage } from "@/lib/chat/types";

type ChatThreadMessage = ArenaChatMessage & { mark: AgentMark };

function kindCaption(message: ArenaChatMessage) {
  if (message.kind === "admin") {
    return message.addressedAgentName ? `to ${message.addressedAgentName}` : "to everyone";
  }

  if (message.kind === "question" && message.addressedAgentName) {
    return `asked ${message.addressedAgentName}`;
  }

  if (message.kind === "reply" && message.addressedAgentName) {
    return `to ${message.addressedAgentName}`;
  }

  return null;
}

export function ChatThread({
  messages,
  className,
}: {
  messages: ChatThreadMessage[];
  className?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const items = layoutArenaChat(messages);

  useLayoutEffect(() => {
    const node = scrollerRef.current;

    if (!node) {
      return;
    }

    node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  return (
    <div
      ref={scrollerRef}
      className={cn("min-h-0 overflow-y-auto overscroll-contain", className)}
    >
      <ol className="mx-auto w-full max-w-[680px]" aria-label="Arena floor">
        {items.map(({ message, side, showTime }) => {
          const center = side === "center";
          const right = side === "right";
          const caption = kindCaption(message);
          const isAdmin = message.agentId === ARENA_ADMIN_AGENT_ID || message.kind === "admin";

          return (
            <li key={message.id}>
              {showTime ? (
                <time
                  className="block py-3 text-center text-[11px] font-medium text-white/35"
                  dateTime={message.createdAt}
                >
                  {formatChartTime(message.createdAt)}
                </time>
              ) : (
                <div className="h-3" />
              )}

              <div className={cn("flex w-full", center ? "justify-center" : right ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "flex max-w-[78%] items-end gap-2",
                    right && "flex-row-reverse",
                    center && "max-w-[88%] flex-col items-center"
                  )}
                >
                  <div className={cn("mb-px shrink-0", center && "mb-1")}>
                    {isAdmin ? (
                      <ArenaAdminAvatar name={message.agentName} size="sm" />
                    ) : (
                      <AgentAvatar mark={message.mark} name={message.agentName} size="sm" />
                    )}
                  </div>

                  <div className={cn("inline-flex min-w-0 max-w-full flex-col", center && "items-center")}>
                    <p
                      className={cn(
                        "px-3 pb-1.5 text-[11px] leading-4 text-white/40",
                        center ? "text-center" : right ? "text-right" : "text-left"
                      )}
                    >
                      {message.agentName}
                      {caption ? <span className="text-white/25"> · {caption}</span> : null}
                    </p>
                    <div
                      className={cn(
                        "w-fit max-w-full rounded-[18px] px-[14px] py-[8px] text-[15px] leading-[20px] break-words tracking-[-0.01em]",
                        isAdmin
                          ? "rounded-b-[4px] border border-[#FFD60A]/25 bg-[#2C2C2E] text-[#FFF9E6]"
                          : right
                            ? "rounded-br-[4px] bg-[#0A84FF] text-white"
                            : "rounded-bl-[4px] bg-[#3A3A3C] text-[#F5F5F7]"
                      )}
                    >
                      <p>{message.body}</p>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

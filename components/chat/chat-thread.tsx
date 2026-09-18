"use client";

import { useLayoutEffect, useRef } from "react";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import { layoutArenaChat } from "@/lib/chat/layout";
import { formatChartTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AgentMark } from "@/types/arena";
import type { ArenaChatMessage } from "@/lib/chat/types";

type ChatThreadMessage = ArenaChatMessage & { mark: AgentMark };

function kindCaption(message: ArenaChatMessage) {
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
          const right = side === "right";
          const caption = kindCaption(message);

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

              <div className={cn("flex w-full", right ? "justify-end" : "justify-start")}>
                <div className={cn("flex max-w-[78%] items-end gap-2", right && "flex-row-reverse")}>
                  <div className="mb-px shrink-0">
                    <AgentAvatar mark={message.mark} name={message.agentName} size="sm" />
                  </div>

                  <div className="inline-flex min-w-0 max-w-full flex-col">
                    <p
                      className={cn(
                        "px-3 pb-1.5 text-[11px] leading-4 text-white/40",
                        right ? "text-right" : "text-left"
                      )}
                    >
                      {message.agentName}
                      {caption ? <span className="text-white/25"> · {caption}</span> : null}
                    </p>
                    <div
                      className={cn(
                        "w-fit max-w-full rounded-[18px] px-[14px] py-[8px] text-[15px] leading-[20px] break-words tracking-[-0.01em]",
                        right
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

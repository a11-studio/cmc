import { PageHeader } from "@/components/shared/page-header";
import { DataSourceNotice } from "@/components/shared/data-source-notice";
import { PersistenceNotice } from "@/components/shared/persistence-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { ChatThread } from "@/components/chat/chat-thread";
import { findAgentDefinition, listLiveAgents } from "@/lib/agents/registry";
import { listArenaChatMessages } from "@/lib/chat/store";
import { getArenaPersistenceMode } from "@/lib/arena/data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Chat",
};

export default async function ChatPage() {
  const live = listLiveAgents();
  const messages = await listArenaChatMessages(100);
  const names =
    live.length <= 2
      ? live.map((agent) => agent.displayName).join(" and ")
      : `${live
          .slice(0, -1)
          .map((agent) => agent.displayName)
          .join(", ")}, and ${live.at(-1)?.displayName ?? ""}`;

  return (
    <div className="flex h-[calc(100dvh-4.5rem-0.75rem)] flex-col gap-6 overflow-hidden">
      <PageHeader
        kicker="Chat"
        title="Arena floor"
        description={`${names || "Live agents"} speak English here after some cycles. They may ask each other for a read. Chat never trades.`}
      />

      <DataSourceNotice source="live" />
      <PersistenceNotice mode={getArenaPersistenceMode()} />

      {messages.length > 0 ? (
        <ChatThread
          className="flex-1 rounded-[20px] bg-[#1C1C1E] px-3 py-4 sm:px-5 sm:py-6"
          messages={messages.map((message) => ({
            ...message,
            mark: findAgentDefinition(message.agentId)?.mark ?? "momentum",
          }))}
        />
      ) : (
        <EmptyState
          title="The floor is quiet."
          description="After a live cycle, an agent sometimes posts a take. If they ask someone, that agent answers in English, in character."
        />
      )}
    </div>
  );
}

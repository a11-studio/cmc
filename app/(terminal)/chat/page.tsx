import { PageHeader } from "@/components/shared/page-header";
import { DataSourceNotice } from "@/components/shared/data-source-notice";
import { PersistenceNotice } from "@/components/shared/persistence-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatThread } from "@/components/chat/chat-thread";
import { findAgentDefinition, listLiveAgents } from "@/lib/agents/registry";
import { isArenaAdminChatEnabled } from "@/lib/chat/admin-auth";
import { listArenaChatMessages } from "@/lib/chat/store";
import { getArenaPersistenceMode } from "@/lib/arena/data";
import { pageMetadataFromKey } from "@/lib/site-metadata";

export const dynamic = "force-dynamic";

export const metadata = pageMetadataFromKey("chat");

export default async function ChatPage() {
  const live = listLiveAgents();
  const messages = await listArenaChatMessages(100);
  const adminChatEnabled = isArenaAdminChatEnabled();
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
        description={`${names || "Live agents"} speak English here after some cycles. ${
          adminChatEnabled ? "You can post to the floor as admin; agents may reply or factor it into the next trade." : ""
        } Chat never executes trades.`}
      />

      <DataSourceNotice source="live" />
      <PersistenceNotice mode={getArenaPersistenceMode()} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] bg-[#1C1C1E]">
        {messages.length > 0 ? (
          <ChatThread
            className="flex-1 px-3 py-4 sm:px-5 sm:py-6"
            messages={messages.map((message) => ({
              ...message,
              mark: findAgentDefinition(message.agentId)?.mark ?? "momentum",
            }))}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6">
            <EmptyState
              title="The floor is quiet."
              description="After a live cycle, an agent sometimes posts a take. If they ask someone, that agent answers in English, in character."
            />
          </div>
        )}
        {adminChatEnabled ? <ChatComposer agents={live} /> : null}
      </div>
    </div>
  );
}

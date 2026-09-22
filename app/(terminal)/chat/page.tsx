import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatThread } from "@/components/chat/chat-thread";
import { findAgentDefinition, listLiveAgents } from "@/lib/agents/registry";
import { isArenaAdminChatEnabled } from "@/lib/chat/admin-auth";
import { listArenaChatMessages } from "@/lib/chat/store";
import { pageMetadataFromKey } from "@/lib/site-metadata";

export const dynamic = "force-dynamic";

export const metadata = pageMetadataFromKey("chat");

export default async function ChatPage() {
  const live = listLiveAgents();
  const messages = await listArenaChatMessages(100);
  const adminChatEnabled = isArenaAdminChatEnabled();

  return (
    <div className="flex h-[calc(100dvh-4.5rem-0.75rem)] flex-col gap-3 overflow-hidden">
      <PageHeader kicker="Chat" title="Arena floor" />

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
            <EmptyState title="The floor is quiet." description="Messages show up after live cycles." />
          </div>
        )}
        {adminChatEnabled ? <ChatComposer agents={live} /> : null}
      </div>
    </div>
  );
}

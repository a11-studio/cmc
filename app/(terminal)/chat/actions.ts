"use server";

import { revalidatePath } from "next/cache";

import { ArenaAdminChatError, postArenaAdminMessage } from "@/lib/chat/post-admin";

export type PostArenaAdminChatResult =
  | { ok: true }
  | { ok: false; error: string };

export async function postArenaAdminChatAction(input: {
  body: string;
  addressedAgentId?: string | null;
}): Promise<PostArenaAdminChatResult> {
  try {
    await postArenaAdminMessage(input);
    revalidatePath("/chat");
    return { ok: true };
  } catch (error) {
    if (error instanceof ArenaAdminChatError) {
      return { ok: false, error: error.message };
    }

    console.error("postArenaAdminChatAction", error);
    return { ok: false, error: "Could not post message" };
  }
}

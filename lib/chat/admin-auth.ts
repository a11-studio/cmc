import "server-only";

/** When true, the chat page shows an admin composer (dev default on). */
export function isArenaAdminChatEnabled(): boolean {
  if (process.env.ARENA_ADMIN_CHAT === "true") {
    return true;
  }

  return process.env.NODE_ENV !== "production";
}

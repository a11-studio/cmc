import "server-only";

import { isSupabaseConfigured } from "@/lib/env";

export const serverEnvKeys = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "CMC_API_KEY",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
] as const;

export type ServerEnvKey = (typeof serverEnvKeys)[number];

export function hasServerEnv(key: ServerEnvKey): boolean {
  return Boolean(process.env[key]);
}

export function getServerSecretStatus(): Record<ServerEnvKey, boolean> {
  return {
    SUPABASE_SERVICE_ROLE_KEY: Boolean(getSupabaseServiceRoleKey()),
    CMC_API_KEY: hasServerEnv("CMC_API_KEY"),
    GEMINI_API_KEY: hasServerEnv("GEMINI_API_KEY"),
    GEMINI_MODEL: hasServerEnv("GEMINI_MODEL"),
  };
}

/** Legacy JWT `service_role` or new dashboard **Secret** key (`sb_secret_…`). */
export function getSupabaseServiceRoleKey(): string {
  const secret = process.env.SUPABASE_SECRET_KEY?.trim() ?? "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  // During project migration, Vercel often still has the old JWT in SERVICE_ROLE_KEY.
  if (secret) {
    return secret;
  }

  return serviceRole;
}

export function isSupabasePersistenceConfigured(): boolean {
  return isSupabaseConfigured() && Boolean(getSupabaseServiceRoleKey());
}

export type PersistenceMode = "memory" | "supabase";

export function getPersistenceMode(): PersistenceMode {
  return isSupabasePersistenceConfigured() ? "supabase" : "memory";
}

export function isArenaDashboardLiteEnabled(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): boolean {
  return env.ARENA_DASHBOARD_LITE === "true";
}

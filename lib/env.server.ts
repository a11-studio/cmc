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
    SUPABASE_SERVICE_ROLE_KEY: hasServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    CMC_API_KEY: hasServerEnv("CMC_API_KEY"),
    GEMINI_API_KEY: hasServerEnv("GEMINI_API_KEY"),
    GEMINI_MODEL: hasServerEnv("GEMINI_MODEL"),
  };
}

export function getSupabaseServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
}

export function isSupabasePersistenceConfigured(): boolean {
  return isSupabaseConfigured() && Boolean(getSupabaseServiceRoleKey());
}

export type PersistenceMode = "memory" | "supabase";

export function getPersistenceMode(): PersistenceMode {
  return isSupabasePersistenceConfigured() ? "supabase" : "memory";
}

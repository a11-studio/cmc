/** Supabase dashboard may label this anon or publishable — either env name works. */
function resolveSupabaseBrowserKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    ""
  ).trim();
}

/** Dashboard sometimes copies the REST path; the JS client expects the project origin only. */
export function normalizeSupabaseProjectUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  return trimmed.replace(/\/rest\/v1$/i, "");
}

export const publicEnv = {
  supabaseUrl: normalizeSupabaseProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
  supabaseAnonKey: resolveSupabaseBrowserKey(),
} as const;

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}

import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { getSupabaseServiceRoleKey, isSupabasePersistenceConfigured } from "@/lib/env.server";

export function createSupabaseAdminClient(): SupabaseClient | null {
  if (!isSupabasePersistenceConfigured()) {
    return null;
  }

  return createClient(publicEnv.supabaseUrl, getSupabaseServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

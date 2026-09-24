import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/rest\/v1\/?$/i, "");
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const secret =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim();

if (!url || !secret) {
  console.error("FAIL: missing NEXT_PUBLIC_SUPABASE_URL or server secret key");
  process.exit(1);
}

const admin = createClient(url, secret, { auth: { persistSession: false } });

const { data: agents, error: agentsErr } = await admin.from("agents").select("id").limit(3);
if (agentsErr) {
  console.error("FAIL:", agentsErr.message, agentsErr.code ?? "");
  console.error("If code is PGRST205, run: node --env-file=.env.local scripts/apply-supabase-migrations.mjs");
  process.exit(1);
}

const { count } = await admin
  .from("portfolio_snapshots")
  .select("*", { count: "exact", head: true });

let pubStatus = "skipped";
if (publishable) {
  const pub = createClient(url, publishable, { auth: { persistSession: false } });
  const { error } = await pub.from("agents").select("id").limit(1);
  pubStatus = error ? `FAIL ${error.message}` : "ok";
}

console.log("OK project:", url);
console.log("OK agents:", agents?.map((a) => a.id).join(", ") || "(empty)");
console.log("OK portfolio_snapshots:", count ?? 0);
console.log("OK publishable read:", pubStatus);

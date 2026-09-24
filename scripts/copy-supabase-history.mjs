/**
 * Copy arena history from a source Supabase project to the target (.env.local).
 *
 * Source (old project):
 *   SUPABASE_SOURCE_URL
 *   SUPABASE_SOURCE_SECRET_KEY  (or SUPABASE_SOURCE_SERVICE_ROLE_KEY)
 *
 * Target (new project):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)
 */
import { createClient } from "@supabase/supabase-js";

const PAGE = 400;

function normalizeUrl(raw) {
  return (raw ?? "").trim().replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
}

function secretKey(prefix) {
  return (
    process.env[`${prefix}_SECRET_KEY`] ??
    process.env[`${prefix}_SERVICE_ROLE_KEY`] ??
    ""
  ).trim();
}

function client(url, key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const tables = [
  { name: "agents", onConflict: "id", order: "id" },
  { name: "market_snapshots", onConflict: "id", order: "timestamp" },
  { name: "agent_cycles", onConflict: "id", order: "started_at" },
  { name: "decisions", onConflict: "id", order: "created_at" },
  { name: "risk_checks", onConflict: "id", order: "created_at" },
  { name: "trades", onConflict: "id", order: "created_at" },
  { name: "positions", onConflict: "id", order: "updated_at" },
  { name: "portfolio_snapshots", onConflict: "id", order: "timestamp" },
  { name: "activity_events", onConflict: "id", order: "created_at" },
  { name: "arena_chat_messages", onConflict: "id", order: "created_at" },
];

async function countRows(db, table) {
  const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
  if (error) {
    throw new Error(`${table} count: ${error.message}`);
  }
  return count ?? 0;
}

async function copyTable(source, target, { name, onConflict, order }) {
  const total = await countRows(source, name);
  if (total === 0) {
    console.log(`  ${name}: skip (empty)`);
    return 0;
  }

  let copied = 0;
  let page = 0;

  while (copied < total) {
    const from = page * PAGE;
    const to = from + PAGE - 1;
    const { data, error } = await source
      .from(name)
      .select("*")
      .order(order, { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`${name} read @${from}: ${error.message}`);
    }

    if (!data?.length) {
      break;
    }

    const { error: upsertError } = await target.from(name).upsert(data, { onConflict });
    if (upsertError) {
      throw new Error(`${name} upsert @${from}: ${upsertError.message}`);
    }

    copied += data.length;
    page += 1;
    process.stdout.write(`  ${name}: ${copied}/${total}\r`);
  }

  console.log(`  ${name}: ${copied}/${total} done`);
  return copied;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const sourceUrl = normalizeUrl(process.env.SUPABASE_SOURCE_URL);
  const sourceKey = secretKey("SUPABASE_SOURCE");
  const targetUrl = normalizeUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const targetKey = secretKey("SUPABASE");

  if (!sourceUrl || !sourceKey) {
    console.error("Set SUPABASE_SOURCE_URL and SUPABASE_SOURCE_SECRET_KEY (old project).");
    process.exit(1);
  }
  if (!targetUrl || !targetKey) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (new project).");
    process.exit(1);
  }

  const source = client(sourceUrl, sourceKey);
  const target = client(targetUrl, targetKey);

  console.log("Source:", sourceUrl);
  console.log("Target:", targetUrl);

  for (const table of tables) {
    const n = await countRows(source, table.name);
    const m = await countRows(target, table.name);
    console.log(`  ${table.name}: source=${n} target=${m}`);
  }

  if (dryRun) {
    console.log("Dry run — no writes.");
    return;
  }

  console.log("\nCopying…");
  for (const table of tables) {
    await copyTable(source, target, table);
  }

  console.log("\nVerify target:");
  for (const table of tables) {
    const n = await countRows(target, table.name);
    console.log(`  ${table.name}: ${n}`);
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});

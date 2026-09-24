/**
 * Apply supabase/migrations/*.sql to the linked project database.
 * Requires SUPABASE_DB_PASSWORD (Database → Connection string → postgres password)
 * or SUPABASE_DATABASE_URL (full postgresql://… URL).
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "supabase", "migrations");

function projectRefFromUrl(url) {
  const match = url?.match(/https?:\/\/([^.]+)\.supabase\.co/i);
  return match?.[1] ?? null;
}

function resolveDatabaseUrl() {
  const direct = process.env.SUPABASE_DATABASE_URL?.trim();
  if (direct) {
    return direct;
  }

  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/rest\/v1\/?$/i, "");
  const ref = projectRefFromUrl(projectUrl);
  const region = process.env.SUPABASE_POOLER_REGION?.trim() || "eu-west-2";

  if (!password || !ref) {
    return null;
  }

  // Session pooler (IPv4-friendly). Copy the exact URI from Dashboard → Database → Connect if this fails.
  return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
}

async function main() {
  const databaseUrl = resolveDatabaseUrl();

  if (!databaseUrl) {
    console.error(
      "Set SUPABASE_DB_PASSWORD (from Supabase → Database → Connection string) or SUPABASE_DATABASE_URL."
    );
    process.exit(1);
  }

  const files = (await readdir(migrationsDir))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  for (const file of files) {
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    console.log(`Applying ${file}…`);
    await client.query(sql);
  }

  const { rows } = await client.query("select count(*)::int as n from public.agents");
  console.log(`Done. agents row count: ${rows[0]?.n ?? 0}`);
  await client.end();
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});

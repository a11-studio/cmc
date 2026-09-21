// Slim legacy agent_cycles.payload rows (dry-run by default).
//
//   node --env-file=.env.local scripts/backfill-slim-cycles.mjs
//   node --env-file=.env.local scripts/backfill-slim-cycles.mjs --apply
//   node --env-file=.env.local scripts/backfill-slim-cycles.mjs --apply --batch=50 --max-batches=10
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "@supabase/supabase-js";

// Kept in sync with lib/agent/slim-cycle-backfill.ts (covered by vitest).
function loadSlimmer() {
  return {
    storedCyclePayloadNeedsSlim(payload) {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
      return (
        "snapshot" in payload ||
        "account" in payload ||
        "events" in payload ||
        "trace" in payload ||
        (payload.execution &&
          typeof payload.execution === "object" &&
          ("account" in payload.execution || "valuation" in payload.execution))
      );
    },
    slimStoredCyclePayload(payload) {
      const beforeBytes = JSON.stringify(payload ?? {}).length;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return { slim: {}, changed: false, beforeBytes, afterBytes: beforeBytes };
      }
      if (!this.storedCyclePayloadNeedsSlim(payload)) {
        return { slim: payload, changed: false, beforeBytes, afterBytes: beforeBytes };
      }
      const slim = structuredClone(payload);
      if (!Array.isArray(slim.marketCheckAssets) && slim.snapshot?.assets) {
        slim.marketCheckAssets = slim.snapshot.assets
          .filter((a) => a && typeof a.symbol === "string" && typeof a.price === "number" && a.price > 0)
          .map((a) => ({ symbol: a.symbol, price: a.price }));
      }
      delete slim.trace;
      delete slim.snapshot;
      delete slim.account;
      delete slim.events;
      if (slim.execution && typeof slim.execution === "object") {
        delete slim.execution.account;
        delete slim.execution.valuation;
      }
      const afterBytes = JSON.stringify(slim).length;
      return { slim, changed: true, beforeBytes, afterBytes };
    },
    approximatePayloadBytes(value) {
      return JSON.stringify(value ?? {}).length;
    },
  };
}

function parseArgs(argv) {
  const apply = argv.includes("--apply");
  let batch = 50;
  let maxBatches = 20;

  for (const arg of argv) {
    if (arg.startsWith("--batch=")) batch = Number(arg.slice("--batch=".length));
    if (arg.startsWith("--max-batches=")) maxBatches = Number(arg.slice("--max-batches=".length));
  }

  return { apply, batch, maxBatches };
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function main() {
  const { apply, batch, maxBatches } = parseArgs(process.argv.slice(2));
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { storedCyclePayloadNeedsSlim, slimStoredCyclePayload } = loadSlimmer();

  console.log(apply ? "Mode: APPLY" : "Mode: DRY RUN (pass --apply to write)");

  let updated = 0;
  let savedBytes = 0;
  let offset = 0;
  const pageSize = 100;
  let emptyFatPages = 0;

  for (let batchIndex = 0; batchIndex < maxBatches && emptyFatPages < 3; batchIndex += 1) {
    const fatRows = [];

    while (fatRows.length < batch && emptyFatPages < 3) {
      const { data, error } = await client
        .from("agent_cycles")
        .select("agent_id, cycle_id, payload")
        .neq("status", "CLAIMED")
        .order("started_at", { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) throw new Error(`fetch: ${error.message}`);
      if (!data?.length) break;

      offset += data.length;

      for (const row of data) {
        if (storedCyclePayloadNeedsSlim(row.payload)) {
          fatRows.push(row);
          if (fatRows.length >= batch) break;
        }
      }

      if (!data.length) break;
    }

    if (fatRows.length === 0) {
      emptyFatPages += 1;
      continue;
    }

    emptyFatPages = 0;

    for (const row of fatRows) {
      const { slim, changed, beforeBytes, afterBytes } = slimStoredCyclePayload(row.payload);

      if (!changed) continue;

      savedBytes += beforeBytes - afterBytes;
      console.log(
        `${row.agent_id} ${row.cycle_id}: ${beforeBytes} → ${afterBytes} B (${Math.round((1 - afterBytes / beforeBytes) * 100)}% smaller)`
      );

      if (apply) {
        const { error: updateError } = await client
          .from("agent_cycles")
          .update({ payload: slim })
          .eq("agent_id", row.agent_id)
          .eq("cycle_id", row.cycle_id);

        if (updateError) throw new Error(`update ${row.cycle_id}: ${updateError.message}`);
      }

      updated += 1;
    }

    if (!apply) break;
  }

  console.log(`Rows ${apply ? "updated" : "would update"}: ${updated}`);
  console.log(`Estimated payload bytes saved this run: ${savedBytes}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

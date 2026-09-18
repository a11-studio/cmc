import { runMomentumAlphaCycle } from "@/lib/agent/runtime";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    return true;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runMomentumAlphaCycle();

  return Response.json({
    status: result.status,
    agentId: result.agentId,
    strategy: result.strategy,
    cycleId: result.cycleId,
    snapshotTimestamp: result.snapshotTimestamp,
    decision: result.decision,
    riskResult: result.riskResult,
    execution: result.execution,
    failure: result.failure ?? null,
    trace: result.trace,
  });
}

export function GET(request: Request): Promise<Response> {
  return handle(request);
}

export function POST(request: Request): Promise<Response> {
  return handle(request);
}

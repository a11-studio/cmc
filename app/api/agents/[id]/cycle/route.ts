import { isCronAuthorized } from "@/lib/agent/cron";
import { runConfiguredAgentCycle } from "@/lib/agent/runtime";
import { isUnknownAgentError } from "@/lib/agents/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: Request, agentId: string): Promise<Response> {
  if (!isCronAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runConfiguredAgentCycle(agentId);

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
  } catch (error) {
    if (isUnknownAgentError(error)) {
      return Response.json({ error: error.message, code: error.code }, { status: 404 });
    }

    throw error;
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await context.params;
  return handle(request, id);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await context.params;
  return handle(request, id);
}

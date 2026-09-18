import { getLiveOrSampleDecision } from "@/lib/arena/data";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const decision = await getLiveOrSampleDecision(id);

  if (!decision) {
    return Response.json({ error: "Decision not found" }, { status: 404 });
  }

  return Response.json(decision);
}

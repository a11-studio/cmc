import { getMomentumAlphaView } from "@/lib/arena/data";
import { serializeMomentumAlphaApi } from "@/lib/agent/view";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = serializeMomentumAlphaApi(await getMomentumAlphaView());
  return Response.json(payload);
}

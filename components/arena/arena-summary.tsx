import { Card } from "@/components/ui/card";
import { Metric } from "@/components/shared/metric";
import { SignedPercent } from "@/components/shared/signed-value";
import { formatUsd } from "@/lib/format";

export function ArenaSummary({
  activeAgents,
  totalEquity,
  bestReturn,
}: {
  activeAgents: number;
  totalEquity: number;
  bestReturn: number;
}) {
  return (
    <Card className="px-6 py-5">
      <div className="grid gap-6 sm:grid-cols-3">
        <Metric label="Active Agents" value={activeAgents} />
        <Metric
          label="Total Arena Equity"
          value={formatUsd(totalEquity)}
          hint="Includes paused agents"
        />
        <Metric label="Best Return" value={<SignedPercent value={bestReturn} />} />
      </div>
    </Card>
  );
}

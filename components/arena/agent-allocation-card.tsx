import { DashboardCard, DashboardCardTitle } from "@/components/arena/dashboard-card";
import { DataSourceBadge } from "@/components/shared/data-source-badge";
import { formatPercent } from "@/lib/format";
import type { MomentumAlphaView } from "@/lib/agent/view";

const SLICE_COLORS = ["#00D4CF", "#008D8A", "#006967", "#0C3E3D", "#1A2E2E"] as const;

type AllocationSlice = {
  id: string;
  label: string;
  percent: number;
  sample: boolean;
  color: string;
};

export function buildAllocationSlices(books: MomentumAlphaView[]): AllocationSlice[] {
  const total = books.reduce((sum, book) => sum + book.agent.equity, 0);

  if (!(total > 0)) {
    return [];
  }

  const slices: AllocationSlice[] = books.map((book, index) => {
    const deployed = book.positions.reduce((sum, position) => sum + Math.abs(position.marketValue), 0);

    return {
      id: book.agent.id,
      label: book.agent.name,
      percent: (deployed / total) * 100,
      sample: book.agent.dataSource === "sample",
      color: SLICE_COLORS[index] ?? SLICE_COLORS[SLICE_COLORS.length - 1]!,
    };
  });

  const cashPercent = (books.reduce((sum, book) => sum + book.cash, 0) / total) * 100;

  if (cashPercent >= 0.05) {
    slices.push({
      id: "cash",
      label: "Cash",
      percent: cashPercent,
      sample: false,
      color: SLICE_COLORS[4],
    });
  }

  return slices.filter((slice) => slice.percent > 0);
}

export function AgentAllocationCard({
  books,
}: {
  books: MomentumAlphaView[];
}) {
  const slices = buildAllocationSlices(books);

  return (
    <DashboardCard>
      <DashboardCardTitle>Agent allocation</DashboardCardTitle>
      <p className="mt-1 text-[14px] leading-5 font-medium text-white/50">Deployed capital versus cash</p>

      <div className="mt-10 flex h-3 overflow-hidden rounded-full bg-white/6">
        {slices.map((slice) => (
          <div
            key={slice.id}
            className="h-full"
            style={{ width: `${slice.percent}%`, backgroundColor: slice.color }}
            title={`${slice.label} ${formatPercent(slice.percent, false, 0)}`}
          />
        ))}
      </div>

      <ul className="mt-8 space-y-4">
        {slices.map((slice) => (
          <li key={slice.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
              <span className="truncate font-medium">{slice.label}</span>
              {slice.sample ? <DataSourceBadge source="sample" /> : null}
            </span>
            <span className="tabular-nums text-white/70">{formatPercent(slice.percent, false, 0)}</span>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

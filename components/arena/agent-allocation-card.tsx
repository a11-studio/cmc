import { DashboardCard, DashboardCardSubtitle, DashboardCardTitle } from "@/components/arena/dashboard-card";
import { CompositionTrack } from "@/components/arena/composition-bar";
import { DataSourceBadge } from "@/components/shared/data-source-badge";
import { formatPercent } from "@/lib/format";
import { TEAL, type RankedShare } from "@/lib/market/shares";
import type { MomentumAlphaView } from "@/lib/agent/view";

type AllocationSlice = RankedShare & { sample: boolean };

export function buildAllocationSlices(books: MomentumAlphaView[]): AllocationSlice[] {
  const total = books.reduce((sum, book) => sum + book.agent.equity, 0);

  if (!(total > 0)) {
    return [];
  }

  const slices: AllocationSlice[] = books.map((book) => {
    const deployed = book.positions.reduce((sum, position) => sum + Math.abs(position.marketValue), 0);

    return {
      id: book.agent.id,
      label: book.agent.name,
      value: deployed,
      percent: (deployed / total) * 100,
      sample: book.agent.dataSource === "sample",
      color: TEAL[0],
    };
  });

  const cash = books.reduce((sum, book) => sum + book.cash, 0);
  const deployed = slices.filter((slice) => slice.percent >= 0.05);
  const colored = deployed.map((slice, index) => ({
    ...slice,
    color: TEAL[index] ?? TEAL[TEAL.length - 2] ?? TEAL[0],
  }));

  if (cash / total >= 0.0005) {
    colored.push({
      id: "cash",
      label: "Cash",
      value: cash,
      percent: (cash / total) * 100,
      sample: false,
      color: TEAL[TEAL.length - 1]!,
    });
  }

  return colored.filter((slice) => slice.percent >= 0.05);
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
      <DashboardCardSubtitle>Deployed capital versus cash</DashboardCardSubtitle>

      <div className="mt-10">
        <CompositionTrack slices={slices} />
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

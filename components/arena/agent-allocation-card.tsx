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

  const sorted = colored
    .filter((slice) => slice.percent >= 0.05)
    .sort((left, right) => right.percent - left.percent);

  let agentColorIndex = 0;

  return sorted.map((slice) => {
    if (slice.id === "cash") {
      return { ...slice, color: TEAL[TEAL.length - 1]! };
    }

    const color = TEAL[agentColorIndex] ?? TEAL[TEAL.length - 2] ?? TEAL[0];
    agentColorIndex += 1;
    return { ...slice, color };
  });
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

      {/* justify-between spreads the legend over the card so the three top
          cards end on the same line whatever the slice count is. */}
      <ul className="mt-8 flex flex-1 flex-col justify-between gap-4">
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

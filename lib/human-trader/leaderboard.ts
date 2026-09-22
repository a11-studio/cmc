import {
  HUMAN_TRADER_DISPLAY_NAME,
  HUMAN_TRADER_ID,
} from "@/lib/human-trader/constants";
import type { LeaderboardAgent } from "@/types/arena";

export type HumanVsAiLeaderboardRow = {
  id: string;
  name: string;
  equity: number;
  returnPercent: number;
  isHuman: boolean;
  rank: number;
  agent?: LeaderboardAgent;
};

export function buildHumanVsAiLeaderboard(
  agents: readonly LeaderboardAgent[],
  human: { equity: number; returnPercent: number }
): HumanVsAiLeaderboardRow[] {
  const rows: Omit<HumanVsAiLeaderboardRow, "rank">[] = [
    ...agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      equity: agent.equity,
      returnPercent: agent.returnPercent,
      isHuman: false,
      agent,
    })),
    {
      id: HUMAN_TRADER_ID,
      name: HUMAN_TRADER_DISPLAY_NAME,
      equity: human.equity,
      returnPercent: human.returnPercent,
      isHuman: true,
    },
  ];

  const sorted = [...rows].sort((left, right) => right.equity - left.equity);

  return sorted.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
}

export function humanRankInLeaderboard(rows: readonly HumanVsAiLeaderboardRow[]): number | null {
  return rows.find((row) => row.isHuman)?.rank ?? null;
}

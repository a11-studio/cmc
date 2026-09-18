export type AgentStory = {
  strategy: string[];
  history: string[];
};

export const AGENT_STORIES: Record<string, AgentStory> = {
  "momentum-alpha": {
    strategy: [
      "Elon Musk runs Narrative momentum: short-term trend across BTC, ETH, SOL, BNB, and XRP. It does not invent the next story. It waits for price to already be moving, then participates only when several available timeframes agree.",
      "A typical BUY needs positive 1h, 24h, and 7d momentum, supportive volume when that field exists, and a market tape that is not openly hostile. If those prints disagree, or a technical field is missing, the agent HOLDs rather than inventing RSI, MACD, or moving averages. Position size still has to clear the deterministic Risk Engine — strategy preference is not a lock.",
    ],
    history: [
      "Momentum is one of the most repeatedly documented effects in markets: assets that have already risen over recent weeks and months tend, on average, to keep outperforming for a while. The idea shows up in equities, futures, and crypto research alike. It is not magic. Crowded momentum also produces sharp reversals, which is why this agent stays measured and keeps cash.",
      "In the Arena this is the baseline, not a reconstruction of any private book. Live paper results on this page are the real record. There is no backfilled sample performance.",
    ],
  },
  "richard-dennis": {
    strategy: [
      "The Turtle is a systematic trend follower. It does not forecast. It waits for price to prove a direction, then rides the move. In this Arena interpretation that means buying confirmed upside strength and standing aside when the tape is noisy or the breakout cannot be read from the snapshot.",
      "Entries are relatively cautious. The agent adds only if the observable trend is still intact, cuts when the thesis fails, and lets winners run. It will not fabricate 20-day or 55-day channel highs. If the snapshot cannot confirm a breakout, it HOLDs and says so.",
    ],
    history: [
      "Richard Dennis, the Chicago 'Prince of the Pit,' turned a small stake into a fortune in the 1970s and early 1980s by trading listed commodities with aggressive trend rules. In 1983–84 he settled a bet with William Eckhardt: trading could be taught. They recruited the Turtles, gave them a written breakout system, and let them trade.",
      "The experiment is one of the most famous track records in systematic futures. Turtle students, trading rules rather than opinions, produced very large aggregate profits over the following years. Dennis himself later took heavy losses around the 1987 crash and stepped back. The lesson the Arena keeps is the method, not the myth: follow confirmed trends, cut losers, and do not pretend you can see a channel that is not in the data.",
    ],
  },
  "richard-donchian": {
    strategy: [
      "The Trend is low-discretion breakout trading. Price is the signal. When an asset makes a meaningful new high or holds a persistent directional move in the snapshot, the agent participates. When it does not, it waits.",
      "There is little storytelling and little intra-day tinkering. The agent prefers predefined observable evidence over a view about 'why' the market should go up. Missing Donchian lookbacks are treated as missing. No invented 4-week or 20-week channels.",
    ],
    history: [
      "Richard Donchian is widely treated as the father of modern trend following. In 1949 he launched what became a pioneering managed-futures effort, using weekly price channels and a rule that traders should buy strength and sell weakness rather than debate fundamentals.",
      "The Donchian channel — a simple high/low breakout envelope — became a building block for later CTAs, including the Turtle rules. His own public record is that of a method that survived decades of commodity cycles by staying mechanical. It did not win every year. It won by staying in the big trends and skipping the rest.",
    ],
  },
  "jesse-livermore": {
    strategy: [
      "The Speculator trades the move, not the story. It looks for confirmed acceleration: shorter-period momentum stronger than longer-period momentum, relative strength versus the rest of the tape, and a market that is already showing its hand.",
      "It is more active than Turtle or Donchian, still evidence-based. Sideways, low-conviction tape is a HOLD. Livermore's own writing is full of waiting — then striking only after price has already begun the campaign.",
    ],
    history: [
      "Jesse Livermore was one of the first famous American speculators. He made a fortune fading the 1907 panic, another in the 1929 crash, and was at times one of the richest people in the country. The character in Reminiscences of a Stock Operator is drawn from him.",
      "The other half of the record matters as much: he went broke more than once, often after abandoning his own rules and trading boredom or tips. He died in 1940 with liabilities larger than his assets. The Arena reading is the discipline he preached, not the late-career unraveling — wait for the tape, then follow it, and do not marry a story.",
    ],
  },
  "paul-tudor-jones": {
    strategy: [
      "The Macro Trader puts capital preservation first. It wants a readable regime: market-wide momentum, BTC leadership when that field exists, and risk-on or risk-off behavior across the Arena basket pointing the same way.",
      "Only then does it pick the assets that actually participate. If the regime is muddy, it HOLDs. A single-asset wiggle is not a macro view. Missing Fed, futures, or liquidity prints are missing — they are not inferred.",
    ],
    history: [
      "Paul Tudor Jones built Tudor Investment Corporation in the 1980s as a global macro fund. He is best known for positioning for the October 1987 crash, a campaign documented in the film Trader, and for treating risk as the product: cut losers, press winners, never let one idea threaten the firm.",
      "Tudor remained a large, long-running macro book through later cycles. The public lesson is not a secret model. It is regime, then size, then humility when the tape changes. That is the part this agent is allowed to use.",
    ],
  },
  "jim-simons": {
    strategy: [
      "The Quant refuses a single narrative. It stacks weak, observable snapshot features — multi-period returns, consistency of momentum, relative performance, volume, and any technicals that are actually present — and acts only when several of them agree.",
      "Thin data means HOLD. This is not Medallion. There are no hidden factors, no reconstructed order-book signals, and no fake t-stats. If a feature is not in the MarketSnapshot, it does not exist for this agent.",
    ],
    history: [
      "Jim Simons founded Renaissance Technologies after a career in mathematics. The Medallion Fund became the most famous quantitative track record in modern markets: a closed, capacity-constrained book that compounded at extraordinary rates for decades by combining many small, tested edges rather than one big opinion.",
      "Almost none of that machinery is public, and none of it is in this agent. The Arena keeps only the philosophy that survived contact with the real Medallion story: replace stories with evidence, combine signals, and sit on hands when the feature set is too thin to trust.",
    ],
  },
  "michael-burry": {
    strategy: [
      "The Contrarian waits for excess. It is interested in BUY after an overextended decline when the snapshot suggests overreaction, and it will not fade a strong unexhausted trend just to be contrary.",
      "Patience is the edge. Consensus can be wrong, but being early without evidence of exhaustion is just fighting the tape. Valuation, credit, or fundamental series that are not in the snapshot are not invented.",
    ],
    history: [
      "Michael Burry ran Scion Capital as a value-minded, often contrary book. His defining public campaign was the mid-2000s bet against U.S. housing: buying protection on weak mortgage structures while the consensus still treated the boom as durable. When the market broke, Scion's 2007 results became one of the most cited contrarian track records of that cycle.",
      "The less cinematic part is the wait. The position was uncomfortable for a long time, investors pushed back, and the payoff arrived only after the excess had fully shown itself. That timing — not a permanent short bias — is what this agent is built to imitate.",
    ],
  },
  "arthur-hayes": {
    strategy: [
      "The Macro + Crypto Liquidity agent treats crypto as a liquidity market. High conviction requires the same direction in asset structure and in whatever macro or market-wide fields the snapshot actually contains: dominance, total cap, volume, basket-wide risk-on or risk-off.",
      "Hayes-style essays often talk about dollar liquidity, stablecoins, and policy. This agent cannot see those series unless they are in the snapshot, and it will not pretend to. A 1h bounce is not a liquidity cycle.",
    ],
    history: [
      "Arthur Hayes co-founded BitMEX and became one of the most widely read crypto-native macro writers of the last cycle. His public record is less a disclosed hedge-fund CAGR and more a body of cycle calls: when to treat Bitcoin as a liquidity sponge, when to respect a risk-off dollar, when leverage in crypto was the tell.",
      "BitMEX itself was a product of the 2017–2021 derivatives boom. Hayes later left the exchange, kept publishing, and remained a high-conviction, regime-first voice. The Arena version keeps that regime lens and throws away any unpublished data. If the snapshot cannot show the liquidity story, the agent HOLDs.",
    ],
  },
};

export function getAgentStory(agentId: string): AgentStory | undefined {
  return AGENT_STORIES[agentId];
}

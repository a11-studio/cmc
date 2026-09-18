import { SAMPLE_DATA_LABEL } from "@/lib/mock-data";

export function DataSourceNotice({
  source,
  detail,
}: {
  source: "live" | "sample" | "mixed";
  detail?: string;
}) {
  if (source === "sample") {
    return (
      <p className="text-xs text-faint">
        {SAMPLE_DATA_LABEL}
        {detail ? ` — ${detail}` : ""}
      </p>
    );
  }

  if (source === "mixed") {
    return (
      <p className="text-xs text-faint">
        Live paper trading — CoinMarketCap market data, Gemini decisions, deterministic risk, paper execution.
        {detail ? ` ${detail}` : ""}
      </p>
    );
  }

  return (
    <p className="text-xs text-faint">
      Live paper trading — CoinMarketCap market data, Gemini decisions, deterministic risk, paper execution.
      {detail ? ` ${detail}` : ""}
    </p>
  );
}

import { SAMPLE_DATA_LABEL } from "@/lib/mock-data";

export function SampleDataNotice({ detail }: { detail?: string }) {
  return (
    <p className="text-xs text-faint">
      {SAMPLE_DATA_LABEL}
      {detail ? ` — ${detail}` : ""}
    </p>
  );
}

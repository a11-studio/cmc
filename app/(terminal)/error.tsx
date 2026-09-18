"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function TerminalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;

  return (
    <ErrorState
      description="A live view failed to load. Retry keeps you on this route."
      onRetry={reset}
    />
  );
}

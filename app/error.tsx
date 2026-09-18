"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6">
      <ErrorState onRetry={reset} />
    </div>
  );
}

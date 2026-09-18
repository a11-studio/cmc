"use client";

import { Button } from "@/components/ui/button";

export function ErrorState({
  title = "The Arena hit a problem.",
  description = "The last request failed. Retry the view, or go back to the leaderboard.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="py-16">
      <p className="text-xs font-medium tracking-[0.18em] text-tertiary uppercase">Error</p>
      <h1 className="mt-3 text-2xl font-semibold text-foreground">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {onRetry ? (
          <Button type="button" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
        <a href="/" className="text-sm text-positive transition-colors hover:text-positive-bright">
          Back to Arena
        </a>
      </div>
    </div>
  );
}

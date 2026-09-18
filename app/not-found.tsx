import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-xs font-medium tracking-[0.18em] text-tertiary uppercase">
        Not found
      </p>
      <h1 className="mt-3 text-2xl font-semibold text-foreground">This view does not exist.</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        The agent, decision, or route you requested is not part of the current Arena.
      </p>
      <Link
        href="/"
        className="mt-6 text-sm text-positive transition-colors hover:text-positive-bright"
      >
        Back to Arena
      </Link>
    </div>
  );
}

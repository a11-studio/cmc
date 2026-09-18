export function PersistenceNotice({ mode }: { mode: "memory" | "supabase" }) {
  if (mode === "supabase") {
    return (
      <p className="text-xs text-faint">
        Portfolio, trades, and cycle history persist in Supabase. This page refreshes when new activity arrives.
      </p>
    );
  }

  return (
    <p className="text-xs text-faint">
      Supabase is not configured. Elon Musk state lives in this server process and resets on reload.
    </p>
  );
}

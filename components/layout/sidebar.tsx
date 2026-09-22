import Link from "next/link";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { cn } from "@/lib/utils";

export function Sidebar({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "flex h-dvh w-[220px] shrink-0 flex-col border-r border-border bg-surface-1 lg:sticky lg:top-0",
        className
      )}
    >
      <div className="flex h-16 items-center border-b border-border px-5">
        <Link href="/" className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-foreground uppercase">
            THE ARENA
          </p>
          <p className="mt-0.5 text-[11px] text-faint">Paper trading</p>
        </Link>
      </div>
      <SidebarNav />
    </aside>
  );
}

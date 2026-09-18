import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function DashboardCard({
  children,
  className,
  tone = "default",
  id,
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "performance" | "performance-down";
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "flex h-full flex-col rounded-[20px] p-6 md:p-8 xl:p-10",
        tone === "performance"
          ? "bg-[#0B1F0C] text-white"
          : tone === "performance-down"
            ? "bg-[#1F0B0C] text-white"
            : "bg-[#101010] text-foreground",
        className
      )}
    >
      {children}
    </section>
  );
}

export function DashboardCardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("text-[19px] leading-7 font-medium tracking-tight", className)}>{children}</h2>;
}

export function DashboardCardSubtitle({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-[14px] leading-5 font-medium text-white/50">{children}</p>;
}

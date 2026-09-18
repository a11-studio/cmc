"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActiveNavPath, PRIMARY_NAV } from "@/lib/layout/nav";
import { cn } from "@/lib/utils";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="px-3 pt-3">
      <ul className="space-y-1">
        {PRIMARY_NAV.map((item) => {
          const active = isActiveNavPath(pathname, item.match);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                prefetch
                onClick={onNavigate}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-[12px] px-3 text-sm transition-colors",
                  active
                    ? "bg-[#1d1d1d] font-medium text-foreground"
                    : "text-tertiary hover:bg-[#101010] hover:text-foreground"
                )}
              >
                <Image src={item.iconSrc} alt="" width={24} height={24} className="size-6" unoptimized />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

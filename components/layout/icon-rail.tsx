"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActiveNavPath, PRIMARY_NAV } from "@/lib/layout/nav";
import { cn } from "@/lib/utils";

export function IconRail() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex flex-col items-center px-3 pb-4">
      {PRIMARY_NAV.map((item) => {
        const active = isActiveNavPath(pathname, item.match);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex size-20 flex-col items-center rounded-[20px] pt-4 text-white transition-colors",
              active ? "bg-[#1d1d1d]" : "hover:bg-[#141414]"
            )}
          >
            <span className="flex size-6 items-center justify-center overflow-hidden">
              <Image src={item.iconSrc} alt="" width={24} height={24} className="size-6" unoptimized />
            </span>
            <span className="mt-[9px] text-[12px] leading-none font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

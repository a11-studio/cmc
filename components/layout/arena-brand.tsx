import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function ArenaBrand({
  showWordmark = true,
  className,
}: {
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <Link href="/" className={cn("flex min-w-0 items-center gap-3", className)}>
      <Image
        src="/brand/arena-mark.svg"
        alt=""
        width={40}
        height={38}
        className="h-[38px] w-10 shrink-0"
        unoptimized
        priority
      />
      {showWordmark ? (
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold tracking-[0.2em] text-foreground uppercase">
            Arena
          </span>
          <span className="mt-0.5 block text-[11px] text-white/45">
            Different minds. Same market.
          </span>
        </span>
      ) : (
        <span className="sr-only">Arena. Different minds. Same market.</span>
      )}
    </Link>
  );
}

import Image from "next/image";
import { cn } from "@/lib/utils";

const sizePx = {
  sm: 28,
  md: 32,
} as const;

export function ArenaAdminAvatar({
  name,
  size = "sm",
}: {
  name: string;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "size-7" : "size-8";
  const pixels = sizePx[size];

  return (
    <span
      aria-hidden="true"
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#141414] ring-1 ring-white/10",
        sizeClass
      )}
    >
      <Image
        src="/brand/arena-mark.svg"
        alt=""
        width={pixels}
        height={pixels}
        className="size-[68%] object-contain"
        unoptimized
      />
    </span>
  );
}

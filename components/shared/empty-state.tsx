export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-[20px] bg-[#101010] px-5 py-10">
      <p className="text-sm text-white/70">{title}</p>
      {description ? <p className="mt-1.5 max-w-lg text-[13px] leading-5 text-white/40">{description}</p> : null}
    </div>
  );
}

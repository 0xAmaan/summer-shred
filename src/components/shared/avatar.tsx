import { cn } from "@/lib/utils";
import { FALLBACK_COLOR } from "@/lib/constants";

const SIZE_CLASS: Record<"sm" | "md" | "lg", string> = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-14 w-14 text-lg",
};

export function ParticipantAvatar({
  name,
  color,
  size = "sm",
  className,
}: {
  name: string;
  color?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const c = color ?? FALLBACK_COLOR;
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-label={name}
      title={name}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold tabular-nums shrink-0 select-none",
        SIZE_CLASS[size],
        className
      )}
      style={{
        backgroundColor: `color-mix(in oklch, ${c} 18%, transparent)`,
        color: `color-mix(in oklch, ${c} 95%, var(--foreground) 5%)`,
        boxShadow: `inset 0 0 0 1.5px color-mix(in oklch, ${c} 55%, transparent)`,
      }}
    >
      {initial}
    </span>
  );
}

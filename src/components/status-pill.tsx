import { cn } from "@/lib/cn";
import { statusLabel } from "@/lib/format";

export function StatusPill({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "chip",
        status === "watching" && "chip-good",
        status === "purchased" && "chip-ink",
        status === "paused" && "chip",
        status === "archived" && "opacity-70",
        className,
      )}
    >
      {status === "watching" ? (
        <span className="size-1.5 rounded-full bg-good" />
      ) : null}
      {statusLabel(status)}
    </span>
  );
}

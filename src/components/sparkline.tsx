import { cn } from "@/lib/cn";

export function Sparkline({
  prices,
  className,
}: {
  prices: number[];
  className?: string;
}) {
  if (prices.length < 2) {
    return (
      <div
        className={cn(
          "flex h-12 items-center justify-end text-[10px] uppercase tracking-[0.12em] text-muted/50",
          className,
        )}
        aria-hidden
      >
        No trend yet
      </div>
    );
  }

  const width = 160;
  const height = 48;
  const padding = 3;
  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  const range = maximum - minimum;

  const coordinates = prices.map((price, index) => {
    const x =
      prices.length === 1 ? width / 2 : (index / (prices.length - 1)) * width;
    const y =
      range === 0
        ? height / 2
        : padding + (1 - (price - minimum) / range) * (height - padding * 2);
    return [Number(x.toFixed(2)), Number(y.toFixed(2))] as const;
  });

  const line = coordinates
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x},${y}`)
    .join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  const first = prices[0];
  const last = prices[prices.length - 1];
  const tone =
    last < first ? "text-good" : last > first ? "text-bad" : "text-muted";
  const [lastX, lastY] = coordinates[coordinates.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("overflow-visible", tone, className)}
      aria-hidden
    >
      <path d={area} fill="currentColor" opacity={0.09} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r={2.2} fill="currentColor" />
    </svg>
  );
}

"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LineChart } from "lucide-react";
import type { PricePoint } from "@/lib/db/schema";
import {
  formatCompactMoney,
  formatDate,
  formatMoney,
  formatShortDate,
} from "@/lib/format";
import { downsample } from "@/lib/stats";

export function PriceChart({
  points,
  currency,
  targetCents,
  lowestCents,
}: {
  points: PricePoint[];
  currency: string;
  targetCents: number | null;
  lowestCents: number | null;
}) {
  if (points.length < 2) {
    return (
      <div className="flex h-[250px] flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-paper/40 px-6 text-center">
        <LineChart className="size-7 text-muted/50" strokeWidth={1.4} />
        <p className="mt-3 text-sm font-medium">The trend appears after two checks.</p>
        <p className="mt-1 max-w-xs text-xs leading-5 text-muted">
          Each check records a point. Run a check now, or wait for the worker to
          fill in the history.
        </p>
      </div>
    );
  }

  const data = downsample(points, 500).map((point) => ({
    t: point.createdAt.getTime(),
    cents: point.priceCents,
  }));

  const showLowest =
    lowestCents !== null &&
    data.some((entry) => entry.cents !== lowestCents) &&
    lowestCents > 0;
  const showTarget = targetCents !== null && targetCents > 0;

  const domainValues = data.map((entry) => entry.cents);
  if (showTarget && targetCents !== null) domainValues.push(targetCents);
  if (showLowest && lowestCents !== null) domainValues.push(lowestCents);
  const minimum = Math.min(...domainValues);
  const maximum = Math.max(...domainValues);
  const padding = Math.max((maximum - minimum) * 0.06, 100);
  const yDomain: [number, number] = [
    Math.max(0, Math.floor((minimum - padding) / 100) * 100),
    Math.ceil((maximum + padding) / 100) * 100,
  ];

  const span = data[data.length - 1].t - data[0].t;

  return (
    <div>
      {(showLowest || showTarget) && (
        <div className="mb-2 flex flex-wrap items-center gap-4 text-[10px] text-muted">
          {showTarget ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-4 border-t border-dashed border-ink/50" />
              Target
            </span>
          ) : null}
          {showLowest ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-4 border-t border-dashed border-good" />
              Lowest recorded
            </span>
          ) : null}
        </div>
      )}
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 6, right: 6, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="price-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e8590c" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#e8590c" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 4"
              vertical={false}
              stroke="#e7e0d3"
            />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(value) => {
                const timestamp = Number(value);
                if (span < 36 * 60 * 60 * 1000) {
                  return new Intl.DateTimeFormat("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(timestamp));
                }
                return formatShortDate(timestamp);
              }}
              tick={{ fill: "#7c7467", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              minTickGap={36}
              tickMargin={10}
            />
            <YAxis
              domain={yDomain}
              tickFormatter={(value) =>
                formatCompactMoney(Number(value), currency)
              }
              tick={{ fill: "#7c7467", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={58}
              tickMargin={4}
            />
            <Tooltip
              cursor={{ stroke: "#d7cebc", strokeDasharray: "3 3" }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e7e0d3",
                backgroundColor: "#fffdf8",
                boxShadow: "0 16px 40px -24px rgba(26,23,18,0.45)",
                fontSize: 12,
                padding: "8px 10px",
              }}
              labelStyle={{ color: "#7c7467", fontSize: 10, marginBottom: 3 }}
              formatter={(value) => [
                formatMoney(Number(value), currency),
                "Price",
              ]}
              labelFormatter={(label) => formatDate(Number(label))}
            />
            {showTarget ? (
              <ReferenceLine
                y={targetCents}
                stroke="#1a1712"
                strokeOpacity={0.45}
                strokeDasharray="4 5"
              />
            ) : null}
            {showLowest ? (
              <ReferenceLine
                y={lowestCents}
                stroke="#177a44"
                strokeOpacity={0.5}
                strokeDasharray="4 5"
              />
            ) : null}
            <Area
              type="linear"
              dataKey="cents"
              stroke="#e8590c"
              strokeWidth={2}
              fill="url(#price-area)"
              dot={false}
              activeDot={{
                r: 4,
                fill: "#e8590c",
                stroke: "#fffdf8",
                strokeWidth: 2,
              }}
              animationDuration={450}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

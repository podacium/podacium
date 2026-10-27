"use client";

import { ResponsiveContainer, LineChart, Line } from "recharts";
import { useTranslations } from "@/lib/i18n";

interface SparklineProps {
  data: number[];
  label: string;
}

export function Sparkline({ data, label }: SparklineProps) {
  const t = useTranslations("common");
  if (!data || data.length < 2) return null;
  return (
    <div
      className="w-16 h-8 opacity-40"
      role="img"
      aria-label={t("uiLabels.trendAria", { label })}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.map((v, i) => ({ v, i }))}>
          <Line
            type="monotone"
            dataKey="v"
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

import {
  Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { DistributionBucket } from "@pokedex/shared";

export function CoverageChart({ distribution }: { distribution: DistributionBucket[] }) {
  const data = distribution.map((bucket) => ({
    label: `${bucket.multiplier}×`,
    count: bucket.count,
  }));

  return (
    <div className="chart-box">
      <h3>How hard your best move hits each Pokémon</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 24, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" />
          <YAxis allowDecimals={false} />
          <Tooltip formatter={(value) => [`${value} Pokémon`, "Count"]} />
          <Bar dataKey="count" name="Pokémon" fill="#4058c8" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="count" position="top" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
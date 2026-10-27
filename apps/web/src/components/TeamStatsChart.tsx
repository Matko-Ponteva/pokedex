import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { PokemonDetail } from "@pokedex/shared";
import { formatPokemonName } from "../lib/format";

const STATS = [
  { name: "hp", label: "HP" },
  { name: "attack", label: "Attack" },
  { name: "defense", label: "Defense" },
  { name: "special-attack", label: "Sp. Atk" },
  { name: "special-defense", label: "Sp. Def" },
  { name: "speed", label: "Speed" },
];

const COLORS = ["#4058c8", "#e0662b", "#2e9d5b", "#c23b8e", "#d4a72c", "#5aa6c9"];

type Props = {
  members: { key: string; detail: PokemonDetail }[];
};

export function TeamStatsChart({ members }: Props) {
  if (members.length === 0) return null;

  const data = STATS.map((stat) => {
    const row: Record<string, string | number> = { stat: stat.label };
    for (const { key, detail } of members) {
      row[key] = detail.stats.find((s) => s.name === stat.name)?.value ?? 0;
    }
    return row;
  });

  return (
    <section className="analysis">
      <h2>Base stats</h2>
      <p className="muted">
        Each member's base stats side by side. Hover or focus a group to see the exact values.
      </p>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="stat" />
            <YAxis />
            <Tooltip />
            <Legend />
            {members.map(({ key, detail }, index) => (
              <Bar
                key={key}
                dataKey={key}
                name={formatPokemonName(detail.name)}
                fill={COLORS[index % COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
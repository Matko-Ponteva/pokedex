const STAT_LABELS: Record<string, string> = {
  hp: "HP", attack: "Attack", defense: "Defense",
  "special-attack": "Sp. Atk", "special-defense": "Sp. Def", speed: "Speed",
};

const STAT_COLORS: Record<string, string> = {
  hp: "#e53935",                // red
  attack: "#f57c00",            // deep orange
  defense: "#ffb74d",           // light orange
  "special-attack": "#1e63c8",  // deep blue
  "special-defense": "#5fa8f0", // light blue
  speed: "#43a047",             // green
};

type Props = { name: string; value: number };

export function StatBar({ name, value }: Props) {
  const percent = Math.min(100, (value / 255) * 100);

  return (
    <div className="stat">
      <span className="stat-label">{STAT_LABELS[name] ?? name}</span>
      <span className="stat-value">{value}</span>
      <div className="stat-track">
        <div className="stat-fill" style={{ width: `${percent}%`, background: STAT_COLORS[name] }} />
      </div>
    </div>
  );
}
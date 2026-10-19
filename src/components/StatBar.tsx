const STAT_LABELS: Record<string, string> = {
  hp: "HP", attack: "Attack", defense: "Defense",
  "special-attack": "Sp. Atk", "special-defense": "Sp. Def", speed: "Speed",
};

type Props = { name: string; value: number };

export function StatBar({ name, value }: Props) {
  const percent = Math.min(100, (value / 255) * 100);

  return (
    <div className="stat">
      <span className="stat-label">{STAT_LABELS[name] ?? name}</span>
      <span className="stat-value">{value}</span>
      <div className="stat-track">
        <div className="stat-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
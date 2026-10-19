const TYPE_COLORS: Record<string, string> = {
  normal: "#9fa19f", fire: "#e62829", water: "#2980ef", electric: "#fac000",
  grass: "#3fa129", ice: "#3dcef3", fighting: "#ff8000", poison: "#9141cb",
  ground: "#915121", flying: "#81b9ef", psychic: "#ef4179", bug: "#91a119",
  rock: "#afa981", ghost: "#704170", dragon: "#5060e1", dark: "#624d4e",
  steel: "#60a1b8", fairy: "#ef70ef",
};

export function TypeBadge({ type }: { type: string }) {
  return (
    <span className="type-badge" style={{ backgroundColor: TYPE_COLORS[type] ?? "#888" }}>
      {type}
    </span>
  );
}
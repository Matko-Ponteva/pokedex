/** Stats a nature can raise or lower (never HP) */
export type NatureStat = "attack" | "defense" | "specialAttack" | "specialDefense" | "speed";

export type Nature = {
  name: string;
  /** Stat raised by 10%, or null for a neutral nature */
  up: NatureStat | null;
  /** Stat lowered by 10%, or null for a neutral nature */
  down: NatureStat | null;
};

const table: [string, NatureStat | null, NatureStat | null][] = [
  ["hardy", null, null],
  ["lonely", "attack", "defense"],
  ["brave", "attack", "speed"],
  ["adamant", "attack", "specialAttack"],
  ["naughty", "attack", "specialDefense"],
  ["bold", "defense", "attack"],
  ["docile", null, null],
  ["relaxed", "defense", "speed"],
  ["impish", "defense", "specialAttack"],
  ["lax", "defense", "specialDefense"],
  ["timid", "speed", "attack"],
  ["hasty", "speed", "defense"],
  ["serious", null, null],
  ["jolly", "speed", "specialAttack"],
  ["naive", "speed", "specialDefense"],
  ["modest", "specialAttack", "attack"],
  ["mild", "specialAttack", "defense"],
  ["quiet", "specialAttack", "speed"],
  ["bashful", null, null],
  ["rash", "specialAttack", "specialDefense"],
  ["calm", "specialDefense", "attack"],
  ["gentle", "specialDefense", "defense"],
  ["sassy", "specialDefense", "speed"],
  ["careful", "specialDefense", "specialAttack"],
  ["quirky", null, null],
];

export const NATURES: Readonly<Record<string, Nature>> = Object.fromEntries(
  table.map(([name, up, down]) => [name, { name, up, down }])
);

export const NATURE_NAMES = table.map(([name]) => name);

export const DEFAULT_NATURE = "hardy";

export const NATURE_STAT_LABELS: Record<NatureStat, string> = {
  attack: "Atk",
  defense: "Def",
  specialAttack: "Sp. Atk",
  specialDefense: "Sp. Def",
  speed: "Spe",
};

export function isNature(value: unknown): value is string {
  return typeof value === "string" && value in NATURES;
}

/** ×1.1 for the raised stat, ×0.9 for the lowered one */
export function natureMultiplier(nature: string | null | undefined, stat: NatureStat): number {
  const entry = nature ? NATURES[nature] : undefined;
  if (!entry) return 1;
  if (entry.up === stat) return 1.1;
  if (entry.down === stat) return 0.9;
  return 1;
}

/** "Adamant (+Atk, −Sp. Atk)" or "Hardy (neutral)" */
export function natureLabel(nature: string): string {
  const entry = NATURES[nature];
  const name = nature.charAt(0).toUpperCase() + nature.slice(1);
  if (!entry?.up || !entry.down) return `${name} (neutral)`;
  return `${name} (+${NATURE_STAT_LABELS[entry.up]}, −${NATURE_STAT_LABELS[entry.down]})`;
}

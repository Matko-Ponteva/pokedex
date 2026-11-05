import type { BoostStat, MoveInfo, StatusCondition } from "./offense.ts";
import type { PokemonType } from "./pokemonTypes.ts";
import type { Weather } from "./weather.ts";

export type ItemCategory = "battle" | "type" | "berry";

export type HeldItem = { name: string; category: ItemCategory; description: string };

/** Items that raise the power of one type's moves by 20% */
export const TYPE_BOOST_ITEMS: Readonly<Record<string, PokemonType>> = {
  "silk-scarf": "normal",
  charcoal: "fire",
  "mystic-water": "water",
  "miracle-seed": "grass",
  magnet: "electric",
  "never-melt-ice": "ice",
  "black-belt": "fighting",
  "poison-barb": "poison",
  "soft-sand": "ground",
  "sharp-beak": "flying",
  "twisted-spoon": "psychic",
  "silver-powder": "bug",
  "hard-stone": "rock",
  "spell-tag": "ghost",
  "dragon-fang": "dragon",
  "black-glasses": "dark",
  "metal-coat": "steel",
  "fairy-feather": "fairy",
};

/** Berries that halve one super-effective hit of their type (Chilan Berry: any Normal hit) */
export const RESIST_BERRIES: Readonly<Record<string, PokemonType>> = {
  "occa-berry": "fire",
  "passho-berry": "water",
  "wacan-berry": "electric",
  "rindo-berry": "grass",
  "yache-berry": "ice",
  "chople-berry": "fighting",
  "kebia-berry": "poison",
  "shuca-berry": "ground",
  "coba-berry": "flying",
  "payapa-berry": "psychic",
  "tanga-berry": "bug",
  "charti-berry": "rock",
  "kasib-berry": "ghost",
  "haban-berry": "dragon",
  "colbur-berry": "dark",
  "babiri-berry": "steel",
  "roseli-berry": "fairy",
  "chilan-berry": "normal",
};

/** Berries that raise a stat when the holder drops to 1/4 HP */
export const PINCH_BERRIES: Readonly<Record<string, BoostStat>> = {
  "liechi-berry": "attack",
  "ganlon-berry": "defense",
  "petaya-berry": "special-attack",
  "apicot-berry": "special-defense",
  "salac-berry": "speed",
};

/** Berries that cure a status condition (or confusion) when it happens; Lum Berry cures any */
export const CURE_BERRIES: Readonly<Record<string, StatusCondition | "confusion" | "any">> = {
  "cheri-berry": "paralysis",
  "chesto-berry": "sleep",
  "pecha-berry": "poison",
  "rawst-berry": "burn",
  "aspear-berry": "freeze",
  "persim-berry": "confusion",
  "lum-berry": "any",
};

/** Berries that heal 1/3 of max HP at 1/4 HP */
export const BIG_HEAL_BERRIES: ReadonlySet<string> = new Set(["figy-berry", "wiki-berry", "mago-berry", "aguav-berry", "iapapa-berry"]);

/** Rocks that make the weather they're tied to last 8 turns */
export const WEATHER_ROCKS: Readonly<Record<string, Weather[]>> = {
  "damp-rock": ["rain"],
  "heat-rock": ["sun"],
  "smooth-rock": ["sand"],
  "icy-rock": ["hail", "snow"],
};

/** The type Natural Gift takes from each berry */
export const NATURAL_GIFT_TYPES: Readonly<Record<string, PokemonType>> = {
  "cheri-berry": "fire",
  "chesto-berry": "water",
  "pecha-berry": "electric",
  "rawst-berry": "grass",
  "aspear-berry": "ice",
  "persim-berry": "ground",
  "lum-berry": "flying",
  "sitrus-berry": "psychic",
  "oran-berry": "poison",
  "figy-berry": "bug",
  "wiki-berry": "rock",
  "mago-berry": "ghost",
  "aguav-berry": "dragon",
  "iapapa-berry": "dark",
  "liechi-berry": "grass",
  "ganlon-berry": "ice",
  "salac-berry": "fighting",
  "petaya-berry": "poison",
  "apicot-berry": "ground",
  ...RESIST_BERRIES,
};

/** Fling's power with each item; any other item flings for 30 */
const FLING_POWER: Readonly<Record<string, number>> = {
  "iron-ball": 130,
  "hard-stone": 100,
  "razor-claw": 80,
  "poison-barb": 70,
  "dragon-fang": 70,
  "assault-vest": 80,
  "heavy-duty-boots": 80,
  "rocky-helmet": 60,
  "damp-rock": 60,
  "heat-rock": 60,
  "smooth-rock": 10,
  "icy-rock": 40,
  "eviolite": 40,
  "black-sludge": 30,
  "expert-belt": 10,
  "focus-sash": 10,
  "choice-band": 10,
  "choice-scarf": 10,
  "choice-specs": 10,
  "life-orb": 30,
  leftovers: 10,
  "kings-rock": 30,
  "razor-fang": 30,
  "toxic-orb": 30,
  "flame-orb": 30,
};

export function isBerry(item: string | null | undefined): boolean {
  return Boolean(item?.endsWith("-berry"));
}

export function flingPower(item: string): number {
  return isBerry(item) ? 10 : (FLING_POWER[item] ?? 30);
}

const typeName = (type: PokemonType) => type.charAt(0).toUpperCase() + type.slice(1);

const battleItems: Record<string, Omit<HeldItem, "category">> = {
  leftovers: { name: "Leftovers", description: "Heals 1/16 of max HP every turn" },
  "black-sludge": { name: "Black Sludge", description: "Heals Poison types 1/16 each turn; hurts others 1/8" },
  "choice-band": { name: "Choice Band", description: "Attack ×1.5, but locks into the first move used" },
  "choice-specs": { name: "Choice Specs", description: "Sp. Atk ×1.5, but locks into the first move used" },
  "choice-scarf": { name: "Choice Scarf", description: "Speed ×1.5, but locks into the first move used" },
  "life-orb": { name: "Life Orb", description: "Attacks deal 30% more, costing 1/10 HP each" },
  "expert-belt": { name: "Expert Belt", description: "Super-effective hits deal 20% more" },
  "muscle-band": { name: "Muscle Band", description: "Physical moves 10% stronger" },
  "wise-glasses": { name: "Wise Glasses", description: "Special moves 10% stronger" },
  "assault-vest": { name: "Assault Vest", description: "Sp. Def ×1.5, but only attacks can be used" },
  eviolite: { name: "Eviolite", description: "Defense and Sp. Def ×1.5 if the holder can still evolve" },
  "rocky-helmet": { name: "Rocky Helmet", description: "Physical attackers lose 1/6 of their HP" },
  "focus-sash": { name: "Focus Sash", description: "Survives a knockout hit from full HP with 1 HP, once" },
  "weakness-policy": { name: "Weakness Policy", description: "+2 Atk and Sp. Atk after a super-effective hit, once" },
  "white-herb": { name: "White Herb", description: "Undoes lowered stats, once" },
  "mental-herb": { name: "Mental Herb", description: "Cures infatuation, Taunt, Encore, Torment, Disable and Heal Block, once" },
  "quick-claw": { name: "Quick Claw", description: "Sometimes moves first in its priority bracket" },
  "bright-powder": { name: "Bright Powder", description: "Foes' moves are 10% less accurate" },
  "lax-incense": { name: "Lax Incense", description: "Foes' moves are 10% less accurate" },
  "wide-lens": { name: "Wide Lens", description: "Moves are 10% more accurate" },
  "zoom-lens": { name: "Zoom Lens", description: "Moves are 20% more accurate when moving after the target" },
  "scope-lens": { name: "Scope Lens", description: "Raises critical-hit chance" },
  "razor-claw": { name: "Razor Claw", description: "Raises critical-hit chance" },
  "kings-rock": { name: "King's Rock", description: "Attacks may make the target flinch" },
  "razor-fang": { name: "Razor Fang", description: "Attacks may make the target flinch" },
  "light-clay": { name: "Light Clay", description: "Reflect, Light Screen and Aurora Veil last 8 turns" },
  "damp-rock": { name: "Damp Rock", description: "Rain lasts 8 turns" },
  "heat-rock": { name: "Heat Rock", description: "Harsh sunlight lasts 8 turns" },
  "smooth-rock": { name: "Smooth Rock", description: "Sandstorms last 8 turns" },
  "icy-rock": { name: "Icy Rock", description: "Hail and snow last 8 turns" },
  "terrain-extender": { name: "Terrain Extender", description: "Terrains last 8 turns" },
  "shell-bell": { name: "Shell Bell", description: "Heals 1/8 of the damage dealt" },
  "toxic-orb": { name: "Toxic Orb", description: "Poisons the holder at the end of the turn" },
  "flame-orb": { name: "Flame Orb", description: "Burns the holder at the end of the turn" },
  "air-balloon": { name: "Air Balloon", description: "Immune to Ground moves until hit" },
  "heavy-duty-boots": { name: "Heavy-Duty Boots", description: "Not affected by hazards" },
  "safety-goggles": { name: "Safety Goggles", description: "Immune to weather damage and powder moves" },
  "protective-pads": { name: "Protective Pads", description: "No contact effects when attacking" },
  "covert-cloak": { name: "Covert Cloak", description: "Immune to added effects of moves" },
  "clear-amulet": { name: "Clear Amulet", description: "Foes can't lower its stats" },
  "eject-button": { name: "Eject Button", description: "Switches out after being hit, once" },
  "red-card": { name: "Red Card", description: "Forces the attacker out after being hit, once" },
  metronome: { name: "Metronome", description: "Using the same move in a row makes it stronger" },
  "iron-ball": { name: "Iron Ball", description: "Halves Speed and grounds the holder" },
  "lagging-tail": { name: "Lagging Tail", description: "Moves last in its priority bracket" },
  "big-root": { name: "Big Root", description: "Draining moves heal 30% more" },
  "binding-band": { name: "Binding Band", description: "Binding moves deal 1/6 instead of 1/8" },
  "grip-claw": { name: "Grip Claw", description: "Binding moves last 7 turns" },
  "blunder-policy": { name: "Blunder Policy", description: "+2 Speed after missing, once" },
  "room-service": { name: "Room Service", description: "−1 Speed when Trick Room starts, once" },
  "loaded-dice": { name: "Loaded Dice", description: "Moves that hit 2–5 times hit 4–5 times, and don't miss after the first hit" },
};

const statNames: Record<BoostStat, string> = {
  attack: "Attack",
  defense: "Defense",
  "special-attack": "Sp. Atk",
  "special-defense": "Sp. Def",
  speed: "Speed",
  accuracy: "accuracy",
  evasion: "evasion",
};

const berryItems: Record<string, Omit<HeldItem, "category">> = {
  "sitrus-berry": { name: "Sitrus Berry", description: "Heals 1/4 of max HP at half HP" },
  "oran-berry": { name: "Oran Berry", description: "Heals 10 HP at half HP" },
  ...Object.fromEntries(
    [...BIG_HEAL_BERRIES].map((slug) => [slug, { name: titleOf(slug), description: "Heals 1/3 of max HP at 1/4 HP" }])
  ),
  ...Object.fromEntries(
    Object.entries(PINCH_BERRIES).map(([slug, stat]) => [slug, { name: titleOf(slug), description: `+1 ${statNames[stat]} at 1/4 HP` }])
  ),
  ...Object.fromEntries(
    Object.entries(CURE_BERRIES).map(([slug, cures]) => [
      slug,
      { name: titleOf(slug), description: cures === "any" ? "Cures any status condition or confusion" : `Cures ${cures}` },
    ])
  ),
  ...Object.fromEntries(
    Object.entries(RESIST_BERRIES).map(([slug, type]) => [
      slug,
      {
        name: titleOf(slug),
        description: type === "normal" ? "Halves damage from a Normal move, once" : `Halves damage from a super-effective ${typeName(type)} move, once`,
      },
    ])
  ),
};

function titleOf(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Every item a Pokémon can hold in battle */
export const HELD_ITEMS: Readonly<Record<string, HeldItem>> = {
  ...Object.fromEntries(Object.entries(battleItems).map(([slug, item]) => [slug, { ...item, category: "battle" as const }])),
  ...Object.fromEntries(
    Object.entries(TYPE_BOOST_ITEMS).map(([slug, type]) => [
      slug,
      { name: titleOf(slug).replace("Never Melt", "Never-Melt"), category: "type" as const, description: `${typeName(type)} moves 20% stronger` },
    ])
  ),
  ...Object.fromEntries(Object.entries(berryItems).map(([slug, item]) => [slug, { ...item, category: "berry" as const }])),
};

export const ITEM_CATEGORY_NAMES: Record<ItemCategory, string> = {
  battle: "Battle items",
  type: "Type boosters",
  berry: "Berries",
};

export function isHeldItem(value: unknown): value is string {
  return typeof value === "string" && value in HELD_ITEMS;
}

export function itemName(item: string): string {
  return HELD_ITEMS[item]?.name ?? titleOf(item);
}

export function itemSpriteUrl(item: string): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${item}.png`;
}

/** Stat multipliers from the attacker's and defender's items, for the damage formula */
export function itemAttackMultiplier(item: string | null, move: MoveInfo): number {
  if (item === "choice-band" && move.category === "physical") return 1.5;
  if (item === "choice-specs" && move.category === "special") return 1.5;
  return 1;
}

export function itemPowerMultiplier(item: string | null, move: MoveInfo): number {
  if (item && TYPE_BOOST_ITEMS[item] === move.type) return 1.2;
  if (item === "muscle-band" && move.category === "physical") return 1.1;
  if (item === "wise-glasses" && move.category === "special") return 1.1;
  return 1;
}

export function itemDefenseMultiplier(item: string | null, physical: boolean, canEvolve: boolean): number {
  if (item === "assault-vest" && !physical) return 1.5;
  if (item === "eviolite" && canEvolve) return 1.5;
  return 1;
}

export function itemFinalMultiplier(item: string | null, effectiveness: number): number {
  if (item === "life-orb") return 1.3;
  if (item === "expert-belt" && effectiveness > 1) return 1.2;
  return 1;
}

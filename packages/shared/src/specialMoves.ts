import type { Combatant, RandomSource } from "./battle.ts";
import { flingPower, isBerry } from "./items.ts";
import type { BoostStat, MoveInfo, StatChange } from "./offense.ts";

/** How damaging moves that ignore the damage formula decide their damage */
export type SpecialDamage =
  /** Damage equal to the user's level (Seismic Toss) */
  | { kind: "level" }
  /** 50%–150% of the user's level */
  | { kind: "psywave" }
  | { kind: "fixed"; amount: number }
  /** Half of the target's remaining HP (Super Fang) */
  | { kind: "half-hp" }
  /** Brings the target's HP down to the user's */
  | { kind: "endeavor" }
  /** Damage equal to the user's HP, and the user faints */
  | { kind: "final-gambit" }
  /** One-hit KO (Fissure, Sheer Cold) */
  | { kind: "ohko" }
  /** Hits back for a multiple of the damage the user took this turn (Counter, Mirror Coat) */
  | { kind: "counter"; category: "physical" | "special" | "any"; multiplier: number };

export const SPECIAL_DAMAGE: Readonly<Record<string, SpecialDamage>> = {
  counter: { kind: "counter", category: "physical", multiplier: 2 },
  "mirror-coat": { kind: "counter", category: "special", multiplier: 2 },
  "metal-burst": { kind: "counter", category: "any", multiplier: 1.5 },
  "seismic-toss": { kind: "level" },
  "night-shade": { kind: "level" },
  psywave: { kind: "psywave" },
  "dragon-rage": { kind: "fixed", amount: 40 },
  "sonic-boom": { kind: "fixed", amount: 20 },
  "super-fang": { kind: "half-hp" },
  "natures-madness": { kind: "half-hp" },
  ruination: { kind: "half-hp" },
  endeavor: { kind: "endeavor" },
  "final-gambit": { kind: "final-gambit" },
  fissure: { kind: "ohko" },
  guillotine: { kind: "ohko" },
  "horn-drill": { kind: "ohko" },
  "sheer-cold": { kind: "ohko" },
};

/** Moves that shield the user from the foe's move this turn */
export const PROTECT_MOVES: ReadonlySet<string> = new Set([
  "protect", "detect", "kings-shield", "spiky-shield", "baneful-bunker", "obstruct", "burning-bulwark", "silk-trap",
]);

/** Damaging moves with their own handling in battle: multiple hits, random outcomes or several turns */
export const UNIQUE_MOVES: ReadonlySet<string> = new Set(["beat-up", "present", "bide"]);

export type PowerContext = {
  attacker: Combatant;
  defender: Combatant;
  random: RandomSource;
  /** The attacker's effective speed and the defender's, after stages and paralysis */
  speeds: [number, number];
  attackerItem?: string | null;
  defenderItem?: string | null;
};

/** The power to use this time, and a line to show before the hit (Magnitude 7!) */
export type PowerResult = { power: number; text?: string } | { fail: string };

/** Pokémon without a known weight (battles started before weights were tracked) count as this heavy */
const DEFAULT_WEIGHT_KG = 50;

function weightOf(combatant: Combatant): number {
  return combatant.weightKg ?? DEFAULT_WEIGHT_KG;
}

/** Low Kick and Grass Knot: heavier targets take more damage */
function targetWeightPower(weightKg: number): number {
  if (weightKg < 10) return 20;
  if (weightKg < 25) return 40;
  if (weightKg < 50) return 60;
  if (weightKg < 100) return 80;
  if (weightKg < 200) return 100;
  return 120;
}

/** Heat Crash and Heavy Slam: the heavier the user is compared with the target, the stronger */
function weightRatioPower(user: number, target: number): number {
  const ratio = user / Math.max(target, 0.1);
  if (ratio >= 5) return 120;
  if (ratio >= 4) return 100;
  if (ratio >= 3) return 80;
  if (ratio >= 2) return 60;
  return 40;
}

/** Flail and Reversal: stronger the less HP the user has left */
function lowHpPower(combatant: Combatant): number {
  const scaled = Math.floor((48 * combatant.hp) / combatant.maxHp);
  if (scaled <= 1) return 200;
  if (scaled <= 4) return 150;
  if (scaled <= 9) return 100;
  if (scaled <= 16) return 80;
  if (scaled <= 32) return 40;
  return 20;
}

/** Crush Grip and Wring Out: stronger the more HP the target has left */
function highHpPower(combatant: Combatant): number {
  return Math.max(1, Math.floor((120 * combatant.hp) / combatant.maxHp));
}

const MAGNITUDES = [
  { chance: 5, magnitude: 4, power: 10 },
  { chance: 10, magnitude: 5, power: 30 },
  { chance: 20, magnitude: 6, power: 50 },
  { chance: 30, magnitude: 7, power: 70 },
  { chance: 20, magnitude: 8, power: 90 },
  { chance: 10, magnitude: 9, power: 110 },
  { chance: 5, magnitude: 10, power: 150 },
];

function magnitude(random: RandomSource): PowerResult {
  let roll = random() * 100;
  for (const entry of MAGNITUDES) {
    roll -= entry.chance;
    if (roll < 0) return { power: entry.power, text: `Magnitude ${entry.magnitude}!` };
  }
  return { power: 150, text: "Magnitude 10!" };
}

const POSITIVE_BOOST_STATS: BoostStat[] = ["attack", "defense", "special-attack", "special-defense", "speed", "accuracy", "evasion"];

/** Trump Card's power by the PP left after using it */
const TRUMP_CARD_PP = 5;
function trumpCardPower(uses: number): PowerResult {
  const left = TRUMP_CARD_PP - uses;
  if (left < 0) return { fail: "But there's no PP left for this move!" };
  return { power: [200, 80, 60, 50][left] ?? 40 };
}

/**
 * Damaging moves whose power is worked out in battle. Friendship isn't tracked, so Return, Frustration and the
 * Let's Go moves use their best power, like a Pokémon raised for the move.
 */
export const VARIABLE_POWER: Readonly<Record<string, (context: PowerContext) => PowerResult>> = {
  "low-kick": ({ defender }) => ({ power: targetWeightPower(weightOf(defender)) }),
  "grass-knot": ({ defender }) => ({ power: targetWeightPower(weightOf(defender)) }),
  "heat-crash": ({ attacker, defender }) => ({ power: weightRatioPower(weightOf(attacker), weightOf(defender)) }),
  "heavy-slam": ({ attacker, defender }) => ({ power: weightRatioPower(weightOf(attacker), weightOf(defender)) }),
  flail: ({ attacker }) => ({ power: lowHpPower(attacker) }),
  reversal: ({ attacker }) => ({ power: lowHpPower(attacker) }),
  "crush-grip": ({ defender }) => ({ power: highHpPower(defender) }),
  "wring-out": ({ defender }) => ({ power: highHpPower(defender) }),
  "electro-ball": ({ speeds: [user, target] }) => {
    const ratio = target > 0 ? user / target : Infinity;
    return { power: ratio >= 4 ? 150 : ratio >= 3 ? 120 : ratio >= 2 ? 80 : ratio >= 1 ? 60 : 40 };
  },
  "gyro-ball": ({ speeds: [user, target] }) => ({
    power: user > 0 ? Math.min(150, Math.floor((25 * target) / user) + 1) : 150,
  }),
  return: () => ({ power: 102 }),
  frustration: () => ({ power: 102 }),
  "pika-papow": () => ({ power: 102 }),
  "veevee-volley": () => ({ power: 102 }),
  punishment: ({ defender }) => {
    const raised = POSITIVE_BOOST_STATS.reduce((sum, stat) => sum + Math.max(0, defender.boosts[stat] ?? 0), 0);
    return { power: Math.min(200, 60 + 20 * raised) };
  },
  magnitude: ({ random }) => magnitude(random),
  "trump-card": ({ attacker }) => trumpCardPower(attacker.uses?.["trump-card"] ?? 0),
  fling: ({ attackerItem }) => (attackerItem ? { power: flingPower(attackerItem) } : { fail: "But it failed!" }),
  "natural-gift": ({ attackerItem }) => (isBerry(attackerItem) ? { power: 80 } : { fail: "But it failed!" }),
  "knock-off": ({ defenderItem }) => ({ power: defenderItem ? 97 : 65 }),
  "spit-up": ({ attacker }) => {
    const stored = attacker.stockpile ?? 0;
    return stored > 0 ? { power: 100 * stored } : { fail: "But it failed to spit up a thing!" };
  },
};

export function hasBattleEffect(move: MoveInfo): boolean {
  return move.name in SPECIAL_DAMAGE || move.name in VARIABLE_POWER || UNIQUE_MOVES.has(move.name);
}

/** A short description of how a move's damage works, for moves without a fixed power */
export function specialMoveNote(move: MoveInfo): string | null {
  const special = SPECIAL_DAMAGE[move.name];
  if (special) {
    switch (special.kind) {
      case "counter": {
        const hit = special.category === "any" ? "" : `${special.category} `;
        return `Returns ${special.multiplier}× the ${hit}damage taken`;
      }
      case "level":
        return "Damage equals level";
      case "psywave":
        return "50–150% of level";
      case "fixed":
        return `Always ${special.amount} damage`;
      case "half-hp":
        return "Halves foe's HP";
      case "endeavor":
        return "Cuts foe's HP to yours";
      case "final-gambit":
        return "Damage equals your HP; you faint";
      case "ohko":
        return "One-hit KO";
    }
  }
  const notes: Record<string, string> = {
    "low-kick": "Stronger vs heavy foes",
    "grass-knot": "Stronger vs heavy foes",
    "heat-crash": "Stronger when heavier",
    "heavy-slam": "Stronger when heavier",
    flail: "Stronger at low HP",
    reversal: "Stronger at low HP",
    "crush-grip": "Stronger vs healthy foes",
    "wring-out": "Stronger vs healthy foes",
    "electro-ball": "Stronger when faster",
    "gyro-ball": "Stronger when slower",
    return: "Power 102",
    frustration: "Power 102",
    "pika-papow": "Power 102",
    "veevee-volley": "Power 102",
    punishment: "Stronger vs boosted foes",
    magnitude: "Random power 10–150",
    "trump-card": "Stronger as PP runs out",
    "spit-up": "Uses Stockpile",
    "beat-up": "Hits once per healthy teammate",
    present: "Random damage, or heals foe",
    bide: "Waits 2 turns, returns 2× damage",
    stockpile: "Stores up to 3 for Spit Up/Swallow",
    swallow: "Heals 25/50/100% by Stockpile",
  };
  return notes[move.name] ?? null;
}

/** How a multi-hit move hits */
export type MultiHit = {
  min: number;
  max: number;
  /** Power of the first hit, going up by that much each hit (Triple Axel: 20, 40, 60) */
  escalating?: number;
  /** Each hit checks accuracy again and the move stops at the first miss */
  checksEachHit?: boolean;
};

/** Multi-hit moves that PokéAPI has no hit counts for, or that work differently */
const MULTI_HIT_OVERRIDES: Readonly<Record<string, MultiHit>> = {
  "population-bomb": { min: 10, max: 10, checksEachHit: true },
  "triple-axel": { min: 3, max: 3, escalating: 20, checksEachHit: true },
  "triple-kick": { min: 3, max: 3, escalating: 10, checksEachHit: true },
  "tachyon-cutter": { min: 2, max: 2 },
  "triple-dive": { min: 3, max: 3 },
};

/** Stat changes a multi-hit move makes once, after all its hits */
export const AFTER_HITS_STAT_CHANGES: Readonly<Record<string, StatChange[]>> = {
  "scale-shot": [
    { stat: "defense", change: -1 },
    { stat: "speed", change: 1 },
  ],
};

/** How a move hits more than once, or null for a single hit */
export function multiHitOf(move: MoveInfo): MultiHit | null {
  const override = MULTI_HIT_OVERRIDES[move.name];
  if (override) return override;
  if (move.category !== "status" && move.minHits && move.maxHits && move.maxHits > 1) return { min: move.minHits, max: move.maxHits };
  return null;
}

/** "Hits 2–5 times" and the like, for move buttons */
export function multiHitNote(move: MoveInfo): string | null {
  const multi = multiHitOf(move);
  if (!multi) return null;
  const times = multi.min === multi.max ? `${multi.max} times` : `${multi.min}–${multi.max} times`;
  if (multi.escalating) return `Hits ${times}, harder each hit`;
  if (multi.checksEachHit) return `Hits up to ${multi.max} times`;
  return `Hits ${times}`;
}

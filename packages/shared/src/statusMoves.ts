import type { Combatant } from "./battle.ts";
import type { MoveInfo } from "./offense.ts";
import type { PokemonType } from "./pokemonTypes.ts";

/**
 * Effects on one Pokémon that last while it stays in battle (the games' "volatile" statuses).
 * All of them go away when it switches out, except what Baton Pass hands over.
 */
export type Volatiles = {
  /** Turns of confusion left */
  confusion?: number;
  infatuated?: boolean;
  /** Yawn: falls asleep when this reaches 0 at the end of a turn */
  yawn?: number;
  nightmare?: boolean;
  cursed?: boolean;
  /** Perish Song: faints when this reaches 0 */
  perish?: number;
  taunt?: number;
  encore?: { move: string; turns: number };
  torment?: boolean;
  disabled?: { move: string; turns: number };
  healBlock?: number;
  ingrain?: boolean;
  aquaRing?: boolean;
  destinyBond?: boolean;
  grudge?: boolean;
  /** Mean Look, Block, Spider Web, Octolock: can't switch out */
  trapped?: boolean;
  octolock?: boolean;
  /** Wrap, Fire Spin and the like: hurt each turn and can't switch out */
  bound?: { move: string; turns: number };
  magnetRise?: number;
  telekinesis?: number;
  /** Lock-On, Mind Reader: the next move can't miss */
  lockOn?: number;
  /** Foresight lets Normal and Fighting moves hit Ghost types; Miracle Eye lets Psychic moves hit Dark types */
  identified?: "foresight" | "miracle-eye";
  laserFocus?: number;
  /** Extra critical-hit stages from Focus Energy */
  critStage?: number;
  imprison?: boolean;
  tarShot?: boolean;
  transformed?: boolean;
  /** The move a Choice item locked it into */
  choiceLock?: string;
  /** Flash Fire powered up its Fire moves */
  flashFire?: boolean;
  /** Unburden doubled its Speed after losing its item */
  unburden?: boolean;
  /** Gastro Acid */
  abilitySuppressed?: boolean;
  /** Turns of Embargo left */
  embargo?: number;
  /** Truant: loafs around on its next turn */
  truantLoaf?: boolean;
  /** The move it used last and how many times in a row before that, for the Metronome item */
  metronomeStreak?: { move: string; count: number };
};

export type Gender = "male" | "female";

/** Moves that pick and use another move */
export const CALLING_MOVES: ReadonlySet<string> = new Set([
  "metronome", "mirror-move", "copycat", "assist", "sleep-talk", "nature-power", "me-first",
]);

/** Moves the calling moves never pick */
export const NO_CALL_MOVES: ReadonlySet<string> = new Set([
  ...CALLING_MOVES, "protect", "detect", "endure", "kings-shield", "spiky-shield", "baneful-bunker", "obstruct",
  "burning-bulwark", "silk-trap", "transform", "mimic", "sketch", "struggle", "bide", "destiny-bond", "snatch",
  "magic-coat", "instruct", "focus-punch", "counter", "mirror-coat", "metal-burst", "chatter",
]);

/** Status moves that switch the user out; the player picks who comes in when choosing the move */
export const STATUS_PIVOTS: ReadonlySet<string> = new Set(["baton-pass", "teleport", "shed-tail", "chilly-reception", "parting-shot"]);
/** Damaging moves that switch the user out after they hit */
export const DAMAGING_PIVOTS: ReadonlySet<string> = new Set(["u-turn", "volt-switch", "flip-turn"]);
/** Moves that need the player to choose a team member when picking them */
export const TEAM_TARGET_MOVES: ReadonlySet<string> = new Set([...STATUS_PIVOTS, ...DAMAGING_PIVOTS, "revival-blessing"]);
/** Damaging moves that drag the target out and bring in a random teammate */
export const DRAG_OUT_MOVES: ReadonlySet<string> = new Set(["dragon-tail", "circle-throw"]);
/** Damaging moves that only work on the user's first turn out */
export const FIRST_TURN_MOVES: ReadonlySet<string> = new Set(["fake-out", "first-impression"]);
/** Damaging moves that trap the target without hurting it each turn */
export const PURE_TRAP_MOVES: ReadonlySet<string> = new Set(["spirit-shackle", "anchor-shot", "thousand-waves", "jaw-lock"]);

/** Status moves that act on the foe, so Protect and Substitute can block them */
export const FOE_STATUS_MOVES: ReadonlySet<string> = new Set([
  "leech-seed", "taunt", "encore", "torment", "disable", "heal-block", "attract", "yawn", "nightmare", "spite",
  "mean-look", "block", "spider-web", "octolock", "telekinesis", "foresight", "odor-sleuth", "miracle-eye",
  "trick", "switcheroo", "corrosive-gas", "embargo", "skill-swap", "role-play",
  "doodle", "worry-seed", "simple-beam", "entrainment", "gastro-acid", "bestow",
  "heart-swap", "power-swap", "guard-swap", "guard-split", "power-split", "speed-swap", "topsy-turvy", "pain-split",
  "reflect-type", "soak", "magic-powder", "trick-or-treat", "forests-curse", "electrify", "powder", "transform",
  "mimic", "sketch", "roar", "whirlwind", "instruct", "confuse-ray", "supersonic", "sweet-kiss", "teeter-dance",
  "lock-on", "mind-reader", "psych-up", "conversion-2",
]);
/** Foe-targeting status moves that get past a substitute */
export const BYPASS_SUBSTITUTE: ReadonlySet<string> = new Set([
  "roar", "whirlwind", "psych-up", "heart-swap", "power-swap", "guard-swap", "guard-split", "power-split",
  "speed-swap", "conversion-2", "reflect-type", "spite", "sketch", "mimic", "instruct", "supersonic", "teeter-dance",
]);
/** Status moves whose only effect is confusing the target */
export const CONFUSING_MOVES: ReadonlySet<string> = new Set(["confuse-ray", "supersonic", "sweet-kiss", "teeter-dance", "swagger", "flatter"]);
/** PokéAPI ailments that land on the foe */
export const FOE_VOLATILES: ReadonlySet<string> = new Set([
  "confusion", "infatuation", "trap", "nightmare", "torment", "disable", "yawn", "heal-block", "leech-seed", "tar-shot",
]);

/** Protect variants: what gets through them, and what happens to a physical attacker that runs into them */
export const SHIELDS: Readonly<Record<string, { blocksStatus: boolean; punish?: "attack" | "defense" | "speed" | "spikes" | "poison" | "burn" }>> = {
  protect: { blocksStatus: true },
  detect: { blocksStatus: true },
  "kings-shield": { blocksStatus: false, punish: "attack" },
  obstruct: { blocksStatus: false, punish: "defense" },
  "silk-trap": { blocksStatus: false, punish: "speed" },
  "spiky-shield": { blocksStatus: true, punish: "spikes" },
  "baneful-bunker": { blocksStatus: true, punish: "poison" },
  "burning-bulwark": { blocksStatus: true, punish: "burn" },
};

/** Moves that can't do anything in this app, and why */
export const UNSUPPORTED_REASONS: Readonly<Record<string, string>> = Object.fromEntries(
  [
    "helping-hand", "follow-me", "rage-powder", "ally-switch", "after-you", "quash", "spotlight", "wide-guard", "dragon-cheer",
    "happy-hour",
  ].map((name) => [name, "Only does something in double battles"])
);

/** Status moves that move items or abilities around */
export const ITEM_ABILITY_MOVES: ReadonlySet<string> = new Set([
  "trick", "switcheroo", "bestow", "recycle", "corrosive-gas", "embargo", "teatime", "skill-swap", "role-play", "doodle",
  "worry-seed", "simple-beam", "entrainment", "gastro-acid",
]);

/** Status moves handled by name in battle (besides the weather, field and special-move tables) */
export const STATUS_MOVE_NAMES: ReadonlySet<string> = new Set([
  ...FOE_STATUS_MOVES, ...CALLING_MOVES, ...STATUS_PIVOTS, ...Object.keys(SHIELDS), ...Object.keys(UNSUPPORTED_REASONS),
  ...ITEM_ABILITY_MOVES,
  "endure", "curse", "perish-song", "ingrain", "aqua-ring", "destiny-bond", "grudge", "magnet-rise", "laser-focus",
  "focus-energy", "imprison", "rest", "refresh", "heal-bell", "aromatherapy", "psycho-shift", "lunar-blessing",
  "take-heart", "victory-dance", "shelter", "belly-drum", "acupressure", "conversion", "camouflage", "magic-coat",
  "snatch", "healing-wish", "lunar-dance", "revival-blessing", "wish", "swagger", "flatter", "tar-shot", "power-trick",
  "power-shift",
]);

/** Status moves that only help the user, which Snatch can steal */
export function isSnatchable(move: MoveInfo): boolean {
  if (move.category !== "status") return false;
  if ((move.statChanges ?? []).length > 0 && move.statTarget === "user") return true;
  if ((move.healing ?? 0) > 0) return true;
  return [
    "stockpile", "swallow", "substitute", "rest", "aqua-ring", "ingrain", "focus-energy", "belly-drum", "acupressure",
    "refresh", "heal-bell", "aromatherapy", "magnet-rise", "victory-dance", "shelter", "take-heart", "lunar-blessing",
    "wish", "reflect", "light-screen", "safeguard", "mist", "tailwind", "lucky-chant", "aurora-veil", "laser-focus",
    "imprison", "conversion", "camouflage",
  ].includes(move.name);
}

/** Moves that restore HP, which Heal Block stops */
export function isHealingMove(move: MoveInfo): boolean {
  return (move.healing ?? 0) > 0 || ["rest", "wish", "swallow", "lunar-blessing", "healing-wish", "lunar-dance", "aqua-ring", "ingrain"].includes(move.name);
}

/** What Nature Power turns into on each terrain */
export const NATURE_POWER_MOVES: Readonly<Record<string, MoveInfo>> = {
  none: { name: "tri-attack", type: "normal", category: "special", power: 80, accuracy: 100 },
  electric: { name: "thunderbolt", type: "electric", category: "special", power: 90, accuracy: 100, ailment: "paralysis", ailmentChance: 10 },
  grassy: { name: "energy-ball", type: "grass", category: "special", power: 90, accuracy: 100, statChanges: [{ stat: "special-defense", change: -1 }], statTarget: "target", statChance: 10 },
  misty: { name: "moonblast", type: "fairy", category: "special", power: 95, accuracy: 100, statChanges: [{ stat: "special-attack", change: -1 }], statTarget: "target", statChance: 30 },
  psychic: { name: "psychic", type: "psychic", category: "special", power: 90, accuracy: 100, statChanges: [{ stat: "special-defense", change: -1 }], statTarget: "target", statChance: 10 },
};

/** The type Camouflage gives on each terrain */
export const CAMOUFLAGE_TYPES: Readonly<Record<string, PokemonType>> = {
  none: "normal",
  electric: "electric",
  grassy: "grass",
  misty: "fairy",
  psychic: "psychic",
};

function moveTitle(name: string): string {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Short labels for a Pokémon's volatile effects, shown in its info box */
export function volatileTags(combatant: Combatant): string[] {
  const v = combatant.volatiles;
  if (!v) return [];
  const tags: string[] = [];
  if (v.transformed) tags.push("Transformed");
  if (v.confusion) tags.push("Confused");
  if (v.infatuated) tags.push("In love");
  if (v.yawn) tags.push("Drowsy");
  if (v.nightmare) tags.push("Nightmare");
  if (v.cursed) tags.push("Cursed");
  if (v.perish) tags.push(`Perish ${Math.min(v.perish, 3)}`);
  if (v.taunt) tags.push(`Taunt ${v.taunt}`);
  if (v.encore) tags.push(`Encore: ${moveTitle(v.encore.move)}`);
  if (v.torment) tags.push("Torment");
  if (v.disabled) tags.push(`Disabled: ${moveTitle(v.disabled.move)}`);
  if (v.healBlock) tags.push("Heal Block");
  if (v.ingrain) tags.push("Ingrain");
  if (v.aquaRing) tags.push("Aqua Ring");
  if (v.destinyBond) tags.push("Destiny Bond");
  if (v.grudge) tags.push("Grudge");
  if (v.bound) tags.push(moveTitle(v.bound.move));
  else if (v.trapped) tags.push(v.octolock ? "Octolock" : "Trapped");
  if (v.magnetRise) tags.push("Magnet Rise");
  if (v.telekinesis) tags.push("Telekinesis");
  if (v.lockOn) tags.push("Lock-On");
  if (v.identified) tags.push("Identified");
  if (v.laserFocus) tags.push("Laser Focus");
  if (v.critStage) tags.push("Pumped");
  if (v.imprison) tags.push("Imprison");
  if (v.tarShot) tags.push("Tar Shot");
  if (v.flashFire) tags.push("Flash Fire");
  if (v.abilitySuppressed) tags.push("Ability suppressed");
  if (v.embargo) tags.push("Embargo");
  return tags;
}

/** Chance of a critical hit at a stage: the move's own crit rate plus Focus Energy */
export function criticalChanceAt(stage: number): number {
  return [1 / 24, 1 / 8, 1 / 2][stage] ?? 1;
}

/** A short description of a status move, for move buttons */
export function statusMoveNote(move: MoveInfo): string | null {
  const unsupported = UNSUPPORTED_REASONS[move.name];
  if (unsupported) return unsupported;
  const notes: Record<string, string> = {
    "confuse-ray": "Confuses the foe",
    supersonic: "Confuses the foe",
    "sweet-kiss": "Confuses the foe",
    "teeter-dance": "Confuses the foe",
    attract: "Infatuates a foe of the other gender",
    yawn: "Foe falls asleep next turn",
    nightmare: "Hurts a sleeping foe each turn",
    curse: "Ghosts: curse the foe for half your HP. Others: +Atk +Def −Spe",
    "perish-song": "Both Pokémon faint in 3 turns unless switched",
    taunt: "Foe can't use status moves for 3 turns",
    encore: "Foe must repeat its last move for 3 turns",
    torment: "Foe can't use a move twice in a row",
    disable: "Disables the foe's last move for 4 turns",
    "heal-block": "Foe can't heal for 5 turns",
    ingrain: "Heals 1/16 each turn; can't switch",
    "aqua-ring": "Heals 1/16 each turn",
    "destiny-bond": "If you faint, the attacker does too",
    grudge: "If you faint, the attacker's move loses its PP",
    spite: "Cuts the foe's last move's PP by 4",
    "mean-look": "Foe can't switch out",
    block: "Foe can't switch out",
    "spider-web": "Foe can't switch out",
    octolock: "Traps the foe and lowers its defenses each turn",
    "magnet-rise": "Immune to Ground moves for 5 turns",
    telekinesis: "Foe floats: moves can't miss it for 3 turns",
    "lock-on": "Your next move can't miss",
    "mind-reader": "Your next move can't miss",
    foresight: "Normal and Fighting moves hit the Ghost foe",
    "odor-sleuth": "Normal and Fighting moves hit the Ghost foe",
    "miracle-eye": "Psychic moves hit the Dark foe",
    "laser-focus": "Next move is a critical hit",
    "focus-energy": "Raises critical-hit chance",
    imprison: "Foe can't use moves you also know",
    rest: "Full heal, then sleep for 2 turns",
    refresh: "Cures your burn, poison or paralysis",
    "heal-bell": "Cures your team's status conditions",
    aromatherapy: "Cures your team's status conditions",
    "psycho-shift": "Passes your status condition to the foe",
    "lunar-blessing": "Heals 1/4 and cures status",
    "take-heart": "Cures status, +Sp. Atk +Sp. Def",
    "victory-dance": "+Atk +Def +Spe",
    shelter: "+2 Defense",
    "belly-drum": "Half your HP for maximum Attack",
    acupressure: "Sharply raises a random stat",
    "psych-up": "Copies the foe's stat changes",
    "heart-swap": "Swaps stat changes with the foe",
    "power-swap": "Swaps Attack stat changes with the foe",
    "guard-swap": "Swaps Defense stat changes with the foe",
    "guard-split": "Averages Defense stats with the foe",
    "power-split": "Averages Attack stats with the foe",
    "speed-swap": "Swaps Speed with the foe",
    "power-trick": "Swaps your Attack and Defense",
    "power-shift": "Swaps your attacking and defending stats",
    "topsy-turvy": "Inverts the foe's stat changes",
    "pain-split": "Averages HP with the foe",
    conversion: "Become your first move's type",
    "conversion-2": "Become a type that resists the foe's last move",
    "reflect-type": "Copy the foe's types",
    soak: "Foe becomes Water type",
    "magic-powder": "Foe becomes Psychic type",
    "trick-or-treat": "Adds Ghost to the foe's types",
    "forests-curse": "Adds Grass to the foe's types",
    camouflage: "Changes type with the terrain",
    electrify: "Foe's move this turn becomes Electric",
    powder: "Foe's Fire move this turn explodes",
    "magic-coat": "Bounces status moves back this turn",
    snatch: "Steals the foe's self-help move this turn",
    transform: "Becomes a copy of the foe",
    mimic: "Copies the foe's last move",
    sketch: "Permanently copies the foe's last move",
    instruct: "Foe repeats its last move",
    metronome: "Uses a random move",
    "mirror-move": "Uses the foe's last move",
    copycat: "Uses the last move used in battle",
    assist: "Uses a random teammate's move",
    "sleep-talk": "Uses a random move while asleep",
    "nature-power": "Becomes a move based on the terrain",
    "me-first": "Uses the foe's move first, 1.5× stronger",
    endure: "Survives this turn's hits with 1 HP",
    "kings-shield": "Protects; lowers a physical attacker's Attack",
    obstruct: "Protects; harshly lowers a physical attacker's Defense",
    "silk-trap": "Protects; lowers a physical attacker's Speed",
    "spiky-shield": "Protects; hurts a physical attacker",
    "baneful-bunker": "Protects; poisons a physical attacker",
    "burning-bulwark": "Protects; burns a physical attacker",
    "baton-pass": "Switches out, passing on stat changes",
    teleport: "Switches out",
    "shed-tail": "Half your HP: switch out, leaving a substitute",
    "chilly-reception": "Starts snow and switches out",
    "parting-shot": "Lowers the foe's attacks, then switches out",
    roar: "Forces the foe to switch out",
    whirlwind: "Forces the foe to switch out",
    "healing-wish": "Faint to fully heal the next Pokémon",
    "lunar-dance": "Faint to fully heal the next Pokémon",
    "revival-blessing": "Revives a fainted teammate at half HP",
    wish: "Heals half HP at the end of next turn",
    "u-turn": "Switches out after hitting",
    "volt-switch": "Switches out after hitting",
    "flip-turn": "Switches out after hitting",
    "dragon-tail": "Forces the foe to switch out",
    "circle-throw": "Forces the foe to switch out",
    "fake-out": "Flinches; first turn out only",
    trick: "Swaps items with the foe",
    switcheroo: "Swaps items with the foe",
    bestow: "Gives your item to the foe",
    recycle: "Restores your used-up item",
    "corrosive-gas": "Destroys the foe's item",
    embargo: "Foe can't use its item for 5 turns",
    teatime: "Both Pokémon eat their berries",
    "skill-swap": "Swaps abilities with the foe",
    "role-play": "Copies the foe's ability",
    doodle: "Copies the foe's ability",
    "worry-seed": "Foe's ability becomes Insomnia",
    "simple-beam": "Foe's ability becomes Simple",
    entrainment: "Gives the foe your ability",
    "gastro-acid": "Suppresses the foe's ability",
    "knock-off": "Removes the foe's item; stronger if it has one",
    thief: "Steals the foe's item",
    covet: "Steals the foe's item",
    "bug-bite": "Eats the foe's berry",
    pluck: "Eats the foe's berry",
    incinerate: "Burns up the foe's berry",
    fling: "Throws your item; power depends on it",
    "natural-gift": "Uses your berry; type depends on it",
    "first-impression": "First turn out only",
  };
  return notes[move.name] ?? null;
}

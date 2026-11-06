import type { MoveInfo } from "./offense.ts";
import type { PokemonType } from "./pokemonTypes.ts";
import type { Weather } from "./weather.ts";

/** Move groups some abilities and items care about (PokéAPI has no flags for these) */
export const PUNCH_MOVES: ReadonlySet<string> = new Set([
  "mach-punch", "bullet-punch", "drain-punch", "dynamic-punch", "fire-punch", "ice-punch", "thunder-punch", "focus-punch",
  "hammer-arm", "ice-hammer", "mega-punch", "meteor-mash", "power-up-punch", "shadow-punch", "sky-uppercut", "comet-punch",
  "dizzy-punch", "double-iron-bash", "plasma-fists", "surging-strikes", "wicked-blow", "headlong-rush", "jet-punch", "rage-fist",
]);
export const BITE_MOVES: ReadonlySet<string> = new Set([
  "bite", "crunch", "fire-fang", "ice-fang", "thunder-fang", "poison-fang", "psychic-fangs", "hyper-fang", "super-fang",
  "jaw-lock", "fishious-rend",
]);
export const PULSE_MOVES: ReadonlySet<string> = new Set([
  "aura-sphere", "dark-pulse", "dragon-pulse", "water-pulse", "origin-pulse", "terrain-pulse",
]);
export const SLICING_MOVES: ReadonlySet<string> = new Set([
  "aerial-ace", "air-cutter", "air-slash", "aqua-cutter", "behemoth-blade", "bitter-blade", "ceaseless-edge", "cross-poison",
  "cut", "fury-cutter", "kowtow-cleave", "leaf-blade", "night-slash", "population-bomb", "psycho-cut", "razor-leaf",
  "razor-shell", "sacred-sword", "secret-sword", "slash", "solar-blade", "stone-axe", "x-scissor", "tachyon-cutter", "mighty-cleave",
]);
export const BALL_MOVES: ReadonlySet<string> = new Set([
  "acid-spray", "aura-sphere", "barrage", "beak-blast", "bullet-seed", "egg-bomb", "electro-ball", "energy-ball", "focus-blast",
  "gyro-ball", "ice-ball", "magnet-bomb", "mist-ball", "mud-bomb", "octazooka", "pollen-puff", "pyro-ball", "rock-blast",
  "rock-wrecker", "searing-shot", "seed-bomb", "shadow-ball", "sludge-bomb", "weather-ball", "zap-cannon",
]);
export const SOUND_MOVES: ReadonlySet<string> = new Set([
  "boomburst", "bug-buzz", "chatter", "clanging-scales", "disarming-voice", "echoed-voice", "grass-whistle", "growl",
  "heal-bell", "hyper-voice", "metal-sound", "noble-roar", "overdrive", "parting-shot", "perish-song", "relic-song", "roar",
  "round", "screech", "sing", "snarl", "snore", "sparkling-aria", "supersonic", "uproar", "torch-song", "alluring-voice",
  "psychic-noise",
]);
export const POWDER_MOVES: ReadonlySet<string> = new Set([
  "cotton-spore", "magic-powder", "poison-powder", "powder", "rage-powder", "sleep-powder", "spore", "stun-spore",
]);

/** Abilities that let their user ignore the target's ability while using a move */
export const MOLD_BREAKERS: ReadonlySet<string> = new Set(["mold-breaker", "teravolt", "turboblaze"]);
/** Abilities other abilities and moves can't copy or replace */
export const UNCOPYABLE_ABILITIES: ReadonlySet<string> = new Set([
  "trace", "imposter", "multitype", "stance-change", "schooling", "comatose", "shields-down", "disguise", "rks-system",
  "battle-bond", "power-construct", "ice-face", "gulp-missile", "zen-mode", "wonder-guard", "neutralizing-gas",
]);

/** Pinch abilities: their type gets ×1.5 at 1/3 HP or less */
const PINCH_TYPES: Readonly<Record<string, PokemonType>> = {
  blaze: "fire",
  torrent: "water",
  overgrow: "grass",
  swarm: "bug",
};

/** Abilities that turn Normal moves into another type, 20% stronger */
export const ATE_ABILITIES: Readonly<Record<string, PokemonType>> = {
  pixilate: "fairy",
  aerilate: "flying",
  refrigerate: "ice",
  galvanize: "electric",
};

/** Abilities that handle a move type by absorbing it */
export const ABSORB_ABILITIES: Readonly<Record<string, PokemonType>> = {
  "volt-absorb": "electric",
  "water-absorb": "water",
  "dry-skin": "water",
  "storm-drain": "water",
  "lightning-rod": "electric",
  "motor-drive": "electric",
  "sap-sipper": "grass",
  "flash-fire": "fire",
  "earth-eater": "ground",
  "well-baked-body": "fire",
};

/** Abilities that keep away a status condition */
export const STATUS_IMMUNE_ABILITIES: Readonly<Record<string, string[]>> = {
  immunity: ["poison"],
  "pastel-veil": ["poison"],
  insomnia: ["sleep"],
  "vital-spirit": ["sleep"],
  "sweet-veil": ["sleep"],
  limber: ["paralysis"],
  "water-veil": ["burn"],
  "water-bubble": ["burn"],
  "thermal-exchange": ["burn"],
  "magma-armor": ["freeze"],
  "purifying-salt": ["burn", "poison", "paralysis", "sleep", "freeze"],
  comatose: ["burn", "poison", "paralysis", "sleep", "freeze"],
};

/** What each ability does here; abilities missing from this list have no effect in battles yet */
export const ABILITY_DESCRIPTIONS: Readonly<Record<string, string>> = {
  intimidate: "Lowers the foes' Attack on entry",
  drizzle: "Starts rain on entry",
  drought: "Starts harsh sunlight on entry",
  "sand-stream": "Starts a sandstorm on entry",
  "snow-warning": "Starts snow on entry",
  "orichalcum-pulse": "Starts harsh sunlight on entry; Attack ×1.33 in sun",
  "hadron-engine": "Starts Electric Terrain on entry; Sp. Atk ×1.33 on it",
  "electric-surge": "Starts Electric Terrain on entry",
  "grassy-surge": "Starts Grassy Terrain on entry",
  "misty-surge": "Starts Misty Terrain on entry",
  "psychic-surge": "Starts Psychic Terrain on entry",
  download: "Raises Atk or Sp. Atk on entry, whichever hits the foes' weaker defense",
  "intrepid-sword": "+1 Attack on entry",
  "dauntless-shield": "+1 Defense on entry",
  pressure: "Foe's moves use 2 PP",
  "mold-breaker": "Moves ignore the target's ability",
  teravolt: "Moves ignore the target's ability",
  turboblaze: "Moves ignore the target's ability",
  unnerve: "Foes can't eat berries",
  frisk: "Reveals the foes' items on entry",
  trace: "Copies the foe's ability on entry",
  imposter: "Transforms into the foe on entry",
  "cloud-nine": "Weather has no effect",
  "air-lock": "Weather has no effect",
  "huge-power": "Attack ×2",
  "pure-power": "Attack ×2",
  hustle: "Attack ×1.5, physical moves 20% less accurate",
  guts: "Attack ×1.5 with a status condition, ignoring burn",
  "toxic-boost": "Physical moves ×1.5 while poisoned",
  "flare-boost": "Special moves ×1.5 while burned",
  "quick-feet": "Speed ×1.5 with a status condition",
  "marvel-scale": "Defense ×1.5 with a status condition",
  technician: "Moves with 60 power or less ×1.5",
  adaptability: "Same-type moves ×2 instead of ×1.5",
  "iron-fist": "Punching moves ×1.2",
  "strong-jaw": "Biting moves ×1.5",
  "mega-launcher": "Pulse moves ×1.5",
  sharpness: "Slicing moves ×1.5",
  reckless: "Recoil moves ×1.2",
  "sheer-force": "Moves with added effects ×1.3, but lose the effects",
  "tough-claws": "Physical moves ×1.3",
  "tinted-lens": "Not-very-effective moves deal double",
  sniper: "Critical hits deal 2.25× instead of 1.5×",
  "super-luck": "Raises critical-hit chance",
  merciless: "Always critical hits on poisoned foes",
  "battle-armor": "Can't be hit critically",
  "shell-armor": "Can't be hit critically",
  blaze: "Fire moves ×1.5 at 1/3 HP or less",
  torrent: "Water moves ×1.5 at 1/3 HP or less",
  overgrow: "Grass moves ×1.5 at 1/3 HP or less",
  swarm: "Bug moves ×1.5 at 1/3 HP or less",
  defeatist: "Attack and Sp. Atk halved at half HP or less",
  "solar-power": "Sp. Atk ×1.5 in sun, but loses 1/8 HP each turn",
  "sand-force": "Rock, Ground and Steel moves ×1.3 in a sandstorm",
  analytic: "Moves ×1.3 when moving last",
  pixilate: "Normal moves become Fairy, ×1.2",
  aerilate: "Normal moves become Flying, ×1.2",
  refrigerate: "Normal moves become Ice, ×1.2",
  galvanize: "Normal moves become Electric, ×1.2",
  normalize: "All moves become Normal, ×1.2",
  "water-bubble": "Water moves ×2; halves Fire damage; can't be burned",
  steelworker: "Steel moves ×1.5",
  transistor: "Electric moves ×1.3",
  "dragons-maw": "Dragon moves ×1.5",
  "rocky-payload": "Rock moves ×1.5",
  "thick-fat": "Halves Fire and Ice damage",
  heatproof: "Halves Fire damage",
  multiscale: "Halves damage at full HP",
  "shadow-shield": "Halves damage at full HP",
  filter: "Super-effective damage ×0.75",
  "solid-rock": "Super-effective damage ×0.75",
  "prism-armor": "Super-effective damage ×0.75",
  "fur-coat": "Defense ×2",
  "ice-scales": "Halves special damage",
  fluffy: "Halves physical damage, but Fire deals double",
  "purifying-salt": "Halves Ghost damage; no status conditions",
  levitate: "Immune to Ground moves",
  "flash-fire": "Fire moves power it up instead of hurting it",
  "volt-absorb": "Electric moves heal it instead",
  "water-absorb": "Water moves heal it instead",
  "dry-skin": "Water heals it; Fire hurts more; heals in rain, hurts in sun",
  "storm-drain": "Draws in Water moves, which raise its Sp. Atk instead",
  "lightning-rod": "Draws in Electric moves, which raise its Sp. Atk instead",
  "motor-drive": "Electric moves raise its Speed instead",
  "sap-sipper": "Grass moves raise its Attack instead",
  "earth-eater": "Ground moves heal it instead",
  "well-baked-body": "Fire moves sharply raise its Defense instead",
  "wonder-guard": "Only super-effective moves hit it",
  bulletproof: "Immune to ball and bomb moves",
  soundproof: "Immune to sound moves",
  overcoat: "Immune to weather damage and powder moves",
  "queenly-majesty": "Foes can't use priority moves on it or its ally",
  dazzling: "Foes can't use priority moves on it or its ally",
  "armor-tail": "Foes can't use priority moves on it or its ally",
  "good-as-gold": "Immune to status moves",
  sturdy: "Survives a knockout hit from full HP; immune to one-hit KOs",
  immunity: "Can't be poisoned",
  "pastel-veil": "It and its ally can't be poisoned",
  insomnia: "Can't fall asleep",
  "vital-spirit": "Can't fall asleep",
  "sweet-veil": "It and its ally can't fall asleep",
  limber: "Can't be paralyzed",
  "water-veil": "Can't be burned",
  "thermal-exchange": "Can't be burned; Fire hits raise its Attack",
  "magma-armor": "Can't be frozen",
  comatose: "Counts as asleep, so it can't get another status condition",
  "leaf-guard": "No status conditions in harsh sunlight",
  "own-tempo": "Can't be confused or intimidated",
  oblivious: "Can't be infatuated, taunted or intimidated",
  "inner-focus": "Can't flinch or be intimidated",
  scrappy: "Normal and Fighting moves hit Ghost types; can't be intimidated",
  "shield-dust": "Immune to added effects of moves",
  "clear-body": "Foes can't lower its stats",
  "white-smoke": "Foes can't lower its stats",
  "full-metal-body": "Foes can't lower its stats",
  "hyper-cutter": "Foes can't lower its Attack",
  "keen-eye": "Accuracy can't be lowered; ignores evasion",
  "big-pecks": "Foes can't lower its Defense",
  defiant: "+2 Attack when a foe lowers its stats",
  competitive: "+2 Sp. Atk when a foe lowers its stats",
  contrary: "Stat changes are reversed",
  simple: "Stat changes are doubled",
  unaware: "Ignores the foe's stat changes",
  "swift-swim": "Speed ×2 in rain",
  chlorophyll: "Speed ×2 in harsh sunlight",
  "sand-rush": "Speed ×2 in a sandstorm",
  "slush-rush": "Speed ×2 in hail or snow",
  "surge-surfer": "Speed ×2 on Electric Terrain",
  unburden: "Speed ×2 after its item is used or lost",
  prankster: "Status moves go first (but fail on Dark types)",
  "gale-wings": "Flying moves go first at full HP",
  triage: "Healing moves go first",
  stall: "Moves last in its priority bracket",
  truant: "Can only move every other turn",
  static: "Physical attackers may be paralyzed",
  "flame-body": "Physical attackers may be burned",
  "poison-point": "Physical attackers may be poisoned",
  "effect-spore": "Physical attackers may be poisoned, paralyzed or put to sleep",
  "cute-charm": "Physical attackers of the other gender may fall in love",
  "rough-skin": "Physical attackers lose 1/8 of their HP",
  "iron-barbs": "Physical attackers lose 1/8 of their HP",
  gooey: "Lowers physical attackers' Speed",
  "tangling-hair": "Lowers physical attackers' Speed",
  aftermath: "A physical attacker that knocks it out loses 1/4 HP",
  "poison-touch": "Physical moves may poison the target",
  "speed-boost": "+1 Speed every turn",
  moody: "Each turn a random stat rises sharply and another falls",
  "rain-dish": "Heals 1/16 in rain",
  "ice-body": "Heals 1/16 in hail or snow",
  "poison-heal": "Heals 1/8 each turn while poisoned instead of losing HP",
  "shed-skin": "May cure its status condition each turn",
  hydration: "Cures its status condition in rain",
  "bad-dreams": "Sleeping foes lose 1/8 HP each turn",
  harvest: "May restore a used berry each turn",
  "magic-guard": "Only takes damage from attacks",
  "rock-head": "No recoil damage",
  "serene-grace": "Added effects of moves are twice as likely",
  "no-guard": "Its moves and moves against it always hit",
  "compound-eyes": "Moves are 30% more accurate",
  "sand-veil": "Evasion up in a sandstorm",
  "snow-cloak": "Evasion up in hail or snow",
  infiltrator: "Moves get past screens and substitutes",
  regenerator: "Heals 1/3 HP when switching out",
  "natural-cure": "Cures its status condition when switching out",
  "magic-bounce": "Bounces back status moves",
  synchronize: "Passes on burn, poison and paralysis to the foe that caused it",
  "sticky-hold": "Its item can't be taken",
  klutz: "Can't use its held item",
  "liquid-ooze": "Draining it hurts the drainer instead",
  moxie: "+1 Attack after knocking out a foe",
  "chilling-neigh": "+1 Attack after knocking out a foe",
  "grim-neigh": "+1 Sp. Atk after knocking out a foe",
  "beast-boost": "Raises its highest stat after knocking out a foe",
  "anger-point": "Maxes Attack after taking a critical hit",
  berserk: "+1 Sp. Atk when dropping below half HP",
  stamina: "+1 Defense when hit",
  "weak-armor": "Physical hits lower Defense and sharply raise Speed",
  justified: "+1 Attack when hit by a Dark move",
  rattled: "+1 Speed when hit by a Bug, Ghost or Dark move",
  "water-compaction": "+2 Defense when hit by a Water move",
  "steam-engine": "Maxes Speed when hit by a Fire or Water move",
  "skill-link": "Multi-hit moves always hit the most times",
  "parental-bond": "Attacks hit twice; the second hit has 1/4 power",
  // Abilities that work with an ally in double battles
  "friend-guard": "Allies take 25% less damage",
  plus: "Sp. Atk ×1.5 with a Plus or Minus ally",
  minus: "Sp. Atk ×1.5 with a Plus or Minus ally",
  telepathy: "Avoids its ally's attacks",
  healer: "May cure its ally's status condition each turn",
  "flower-gift": "In harsh sunlight, Attack and Sp. Def ×1.5 for it and its ally",
  "power-spot": "Ally's moves ×1.3",
  battery: "Ally's special moves ×1.3",
  "steely-spirit": "Steel moves ×1.5 for it and its ally",
  "aroma-veil": "It and its ally are safe from Taunt, Torment, Encore, Disable, Heal Block and love",
  "flower-veil": "Foes can't lower the stats of, or give status to, Grass types on its side",
  "curious-medicine": "Clears its ally's stat changes on entry",
  costar: "Copies its ally's stat changes on entry",
  hospitality: "Heals its ally 1/4 on entry",
  receiver: "Takes on the ability of an ally that faints",
  "power-of-alchemy": "Takes on the ability of an ally that faints",
  symbiosis: "Passes its item to an ally that used up its own",
  "victory-star": "Moves of it and its ally are 10% more accurate",
  stalwart: "Its moves can't be drawn away",
  "propeller-tail": "Its moves can't be drawn away",
  commander: "Tatsugiri hides inside an allied Dondozo, sharply raising all its stats",
};

export function hasAbilityEffect(ability: string): boolean {
  return ability in ABILITY_DESCRIPTIONS;
}

export function abilityName(ability: string): string {
  return ability
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** The ability slug for a name as the Pokédex shows it ("solar power" → "solar-power") */
export function abilitySlug(name: string): string {
  return name.trim().toLowerCase().replaceAll(" ", "-");
}

export type AbilityDamageContext = {
  attackerAbility: string | null;
  defenderAbility: string | null;
  weather: Weather | null;
  terrain: string | null;
  effectiveness: number;
  critical: boolean;
  /** The attacker moves after the target this turn, for Analytic */
  movesLast: boolean;
  /** Flash Fire was triggered, so the attacker's Fire moves are stronger */
  flashFire: boolean;
};

/** Whether a move has added effects that Sheer Force removes */
export function hasAddedEffects(move: MoveInfo): boolean {
  if (move.category === "status") return false;
  if (move.ailment || move.volatile || (move.flinchChance ?? 0) > 0) return true;
  const changes = move.statChanges ?? [];
  return changes.length > 0 && (move.statTarget !== "user" || changes.every(({ change }) => change > 0));
}

/** Move power changes from the attacker's ability */
export function abilityPowerMultiplier(move: MoveInfo, power: number, attackerHpRatio: number, ctx: AbilityDamageContext): number {
  const ability = ctx.attackerAbility;
  let multiplier = 1;
  switch (ability) {
    case "technician":
      if (power <= 60) multiplier *= 1.5;
      break;
    case "iron-fist":
      if (PUNCH_MOVES.has(move.name)) multiplier *= 1.2;
      break;
    case "strong-jaw":
      if (BITE_MOVES.has(move.name)) multiplier *= 1.5;
      break;
    case "mega-launcher":
      if (PULSE_MOVES.has(move.name)) multiplier *= 1.5;
      break;
    case "sharpness":
      if (SLICING_MOVES.has(move.name)) multiplier *= 1.5;
      break;
    case "reckless":
      if ((move.drain ?? 0) < 0) multiplier *= 1.2;
      break;
    case "sheer-force":
      if (hasAddedEffects(move)) multiplier *= 1.3;
      break;
    case "tough-claws":
      if (move.category === "physical") multiplier *= 1.3;
      break;
    case "sand-force":
      if (ctx.weather === "sand" && ["rock", "ground", "steel"].includes(move.type)) multiplier *= 1.3;
      break;
    case "analytic":
      if (ctx.movesLast) multiplier *= 1.3;
      break;
    case "toxic-boost":
    case "flare-boost":
      break;
  }
  const pinch = ability ? PINCH_TYPES[ability] : undefined;
  if (pinch === move.type && attackerHpRatio <= 1 / 3) multiplier *= 1.5;
  if (ctx.flashFire && move.type === "fire") multiplier *= 1.5;
  if (ctx.defenderAbility === "dry-skin" && move.type === "fire") multiplier *= 1.25;
  return multiplier;
}

/** Attacking stat changes from the attacker's ability */
export function abilityAttackMultiplier(move: MoveInfo, status: string | null, hpRatio: number, ctx: AbilityDamageContext): number {
  const physical = move.category === "physical";
  let multiplier = 1;
  switch (ctx.attackerAbility) {
    case "huge-power":
    case "pure-power":
      if (physical) multiplier *= 2;
      break;
    case "hustle":
      if (physical) multiplier *= 1.5;
      break;
    case "guts":
      if (physical && status) multiplier *= 1.5;
      break;
    case "toxic-boost":
      if (physical && status === "poison") multiplier *= 1.5;
      break;
    case "flare-boost":
      if (!physical && status === "burn") multiplier *= 1.5;
      break;
    case "solar-power":
      if (!physical && ctx.weather === "sun") multiplier *= 1.5;
      break;
    case "defeatist":
      if (hpRatio <= 0.5) multiplier *= 0.5;
      break;
    case "orichalcum-pulse":
      if (physical && ctx.weather === "sun") multiplier *= 4 / 3;
      break;
    case "hadron-engine":
      if (!physical && ctx.terrain === "electric") multiplier *= 4 / 3;
      break;
    case "water-bubble":
      if (move.type === "water") multiplier *= 2;
      break;
    case "steelworker":
      if (move.type === "steel") multiplier *= 1.5;
      break;
    case "transistor":
      if (move.type === "electric") multiplier *= 1.3;
      break;
    case "dragons-maw":
      if (move.type === "dragon") multiplier *= 1.5;
      break;
    case "rocky-payload":
      if (move.type === "rock") multiplier *= 1.5;
      break;
  }
  // Thick Fat and Water Bubble weaken the attacker against the defender
  const defender = ctx.defenderAbility;
  if (defender === "thick-fat" && (move.type === "fire" || move.type === "ice")) multiplier *= 0.5;
  if (defender === "water-bubble" && move.type === "fire") multiplier *= 0.5;
  if (defender === "purifying-salt" && move.type === "ghost") multiplier *= 0.5;
  return multiplier;
}

/** Defending stat changes from the defender's ability */
export function abilityDefenseMultiplier(physical: boolean, status: string | null, ctx: AbilityDamageContext): number {
  if (ctx.defenderAbility === "fur-coat" && physical) return 2;
  if (ctx.defenderAbility === "marvel-scale" && physical && status) return 1.5;
  return 1;
}

/** Final damage changes from both abilities */
export function abilityFinalMultiplier(move: MoveInfo, defenderAtFullHp: boolean, ctx: AbilityDamageContext): number {
  let multiplier = 1;
  if (ctx.attackerAbility === "tinted-lens" && ctx.effectiveness < 1) multiplier *= 2;
  if (ctx.attackerAbility === "sniper" && ctx.critical) multiplier *= 1.5;
  switch (ctx.defenderAbility) {
    case "multiscale":
    case "shadow-shield":
      if (defenderAtFullHp) multiplier *= 0.5;
      break;
    case "filter":
    case "solid-rock":
    case "prism-armor":
      if (ctx.effectiveness > 1) multiplier *= 0.75;
      break;
    case "ice-scales":
      if (move.category === "special") multiplier *= 0.5;
      break;
    case "fluffy":
      if (move.category === "physical") multiplier *= 0.5;
      if (move.type === "fire") multiplier *= 2;
      break;
    case "heatproof":
      if (move.type === "fire") multiplier *= 0.5;
      break;
  }
  return multiplier;
}

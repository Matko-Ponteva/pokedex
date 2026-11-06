import { z } from "zod";

/** Singles: one Pokémon from each side battles at a time. Doubles: two from each side. */
export type BattleFormat = "singles" | "doubles";

export type Ruleset = {
  id: RulesetId;
  name: string;
  description: string;
  /** Every Pokémon battles at this level */
  level: number;
  format: BattleFormat;
  /** Fewest Pokémon a team may bring */
  minTeamSize: number;
  /** Most Pokémon a team may bring */
  maxTeamSize: number;
};

export const RULESET_IDS = ["standard", "doubles", "3v3", "2v2", "1v1"] as const;
export type RulesetId = (typeof RULESET_IDS)[number];

const LEVEL = 50;

function exactly(id: RulesetId, size: number): Ruleset {
  return {
    id,
    name: `${size}v${size}`,
    description: `Each trainer brings exactly ${size} Pokémon. All Pokémon are set to level ${LEVEL}.`,
    level: LEVEL,
    format: "singles",
    minTeamSize: size,
    maxTeamSize: size,
  };
}

export const RULESETS: Record<RulesetId, Ruleset> = {
  standard: {
    id: "standard",
    name: "Standard",
    description: `Single battle with teams of up to 6 Pokémon. All Pokémon are set to level ${LEVEL}.`,
    level: LEVEL,
    format: "singles",
    minTeamSize: 1,
    maxTeamSize: 6,
  },
  doubles: {
    id: "doubles",
    name: "Doubles",
    description: `Double battle: two Pokémon from each side fight at once. Teams of 2 to 6 Pokémon. All Pokémon are set to level ${LEVEL}.`,
    level: LEVEL,
    format: "doubles",
    minTeamSize: 2,
    maxTeamSize: 6,
  },
  "3v3": exactly("3v3", 3),
  "2v2": exactly("2v2", 2),
  "1v1": exactly("1v1", 1),
};

export const DEFAULT_RULESET: RulesetId = "standard";

export const rulesetIdSchema = z.enum(RULESET_IDS);

export function rulesetOf(id: RulesetId | undefined): Ruleset {
  return RULESETS[id ?? DEFAULT_RULESET] ?? RULESETS[DEFAULT_RULESET];
}

/** How many Pokémon each side has in battle at once */
export function activePerSide(format: BattleFormat): number {
  return format === "doubles" ? 2 : 1;
}

/** Why a team of this size can't battle under the ruleset, or null when it can */
export function teamSizeError(ruleset: Ruleset, size: number): string | null {
  if (size >= ruleset.minTeamSize && size <= ruleset.maxTeamSize) return null;
  if (ruleset.minTeamSize === ruleset.maxTeamSize) {
    const count = ruleset.minTeamSize;
    return `${ruleset.name} battles need a team of exactly ${count} Pokémon`;
  }
  if (size < ruleset.minTeamSize) {
    return `${ruleset.name} battles need a team with at least ${ruleset.minTeamSize} Pokémon`;
  }
  return `${ruleset.name} battles allow at most ${ruleset.maxTeamSize} Pokémon per team`;
}

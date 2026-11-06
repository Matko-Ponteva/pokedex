import { z } from "zod";

export type Ruleset = {
  id: RulesetId;
  name: string;
  description: string;
  /** Every Pokémon battles at this level */
  level: number;
  /** Fewest Pokémon a team may bring */
  minTeamSize: number;
  /** Most Pokémon a team may bring */
  maxTeamSize: number;
};

export const RULESET_IDS = ["standard", "3v3", "2v2", "1v1"] as const;
export type RulesetId = (typeof RULESET_IDS)[number];

const LEVEL = 50;

function exactly(id: RulesetId, size: number): Ruleset {
  return {
    id,
    name: `${size}v${size}`,
    description: `Each trainer brings exactly ${size} Pokémon. All Pokémon are set to level ${LEVEL}.`,
    level: LEVEL,
    minTeamSize: size,
    maxTeamSize: size,
  };
}

export const RULESETS: Record<RulesetId, Ruleset> = {
  standard: {
    id: "standard",
    name: "Standard",
    description: `Teams of up to 6 Pokémon. All Pokémon are set to level ${LEVEL}.`,
    level: LEVEL,
    minTeamSize: 1,
    maxTeamSize: 6,
  },
  "3v3": exactly("3v3", 3),
  "2v2": exactly("2v2", 2),
  "1v1": exactly("1v1", 1),
};

export const DEFAULT_RULESET: RulesetId = "standard";

export const rulesetIdSchema = z.enum(RULESET_IDS);

export function rulesetOf(id: RulesetId | undefined): Ruleset {
  return RULESETS[id ?? DEFAULT_RULESET];
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

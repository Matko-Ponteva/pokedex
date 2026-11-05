import type { MoveInfo } from "./offense.ts";
import type { PokemonType } from "./pokemonTypes.ts";

export type Weather = "rain" | "sun" | "sand" | "hail" | "snow";

/** Weather in play, and how many more end-of-turns it lasts */
export type WeatherState = { kind: Weather; turnsLeft: number };

/** Weather set by a move lasts this many turns, counting the turn it was set */
export const WEATHER_TURNS = 5;

/** Moves that set the weather */
export const WEATHER_MOVES: Readonly<Record<string, Weather>> = {
  "rain-dance": "rain",
  "sunny-day": "sun",
  sandstorm: "sand",
  hail: "hail",
  snowscape: "snow",
};

export const WEATHER_NAMES: Record<Weather, string> = {
  rain: "Rain",
  sun: "Harsh sunlight",
  sand: "Sandstorm",
  hail: "Hail",
  snow: "Snow",
};

export const WEATHER_STARTED: Record<Weather, string> = {
  rain: "It started to rain!",
  sun: "The sunlight turned harsh!",
  sand: "A sandstorm kicked up!",
  hail: "It started to hail!",
  snow: "It started to snow!",
};

export const WEATHER_ENDED: Record<Weather, string> = {
  rain: "The rain stopped.",
  sun: "The harsh sunlight faded.",
  sand: "The sandstorm subsided.",
  hail: "The hail stopped.",
  snow: "The snow stopped.",
};

/** Weather that hurts Pokémon at the end of each turn, and the types it spares */
const CHIP_IMMUNE: Partial<Record<Weather, PokemonType[]>> = {
  sand: ["rock", "ground", "steel"],
  hail: ["ice"],
};

/** Whether the weather chips 1/16 of this Pokémon's max HP at the end of the turn */
export function hurtByWeather(weather: Weather | null, types: readonly PokemonType[]): boolean {
  const immune = weather ? CHIP_IMMUNE[weather] : undefined;
  return immune !== undefined && !types.some((type) => immune.includes(type));
}

export function weatherChipText(weather: Weather, name: string): string {
  return weather === "sand" ? `${name} is buffeted by the sandstorm!` : `${name} is pelted by hail!`;
}

/** Rain strengthens Water moves and weakens Fire moves; harsh sunlight does the opposite */
export function weatherPowerMultiplier(weather: Weather | null, moveType: PokemonType): number {
  if (weather === "rain") return moveType === "water" ? 1.5 : moveType === "fire" ? 0.5 : 1;
  if (weather === "sun") return moveType === "fire" ? 1.5 : moveType === "water" ? 0.5 : 1;
  return 1;
}

/** Sandstorm raises Rock types' Special Defense, and snow raises Ice types' Defense, by half */
export function weatherDefenseMultiplier(
  weather: Weather | null,
  defenderTypes: readonly PokemonType[],
  physical: boolean
): number {
  if (weather === "sand" && !physical && defenderTypes.includes("rock")) return 1.5;
  if (weather === "snow" && physical && defenderTypes.includes("ice")) return 1.5;
  return 1;
}

const WEATHER_BALL_TYPES: Record<Weather, PokemonType> = {
  rain: "water",
  sun: "fire",
  sand: "rock",
  hail: "ice",
  snow: "ice",
};

/** Moves that never miss in rain but are less accurate in harsh sunlight */
const RAIN_SURE_HITS = new Set(["thunder", "hurricane", "bleakwind-storm", "wildbolt-storm", "sandsear-storm"]);
/** Moves charged by sunlight that lose half their power in other weather */
const SOLAR_MOVES = new Set(["solar-beam", "solar-blade"]);

/** A move as it works in the current weather: Weather Ball's type and power, Thunder's accuracy… */
export function weatherAdjustedMove(move: MoveInfo, weather: Weather | null): MoveInfo {
  if (!weather) return move;
  if (move.name === "weather-ball") return { ...move, type: WEATHER_BALL_TYPES[weather], power: (move.power ?? 50) * 2 };
  if (RAIN_SURE_HITS.has(move.name)) {
    if (weather === "rain") return { ...move, accuracy: null };
    if (weather === "sun") return { ...move, accuracy: 50 };
  }
  if (move.name === "blizzard" && (weather === "hail" || weather === "snow")) return { ...move, accuracy: null };
  if (SOLAR_MOVES.has(move.name) && weather !== "sun" && move.power !== null) {
    return { ...move, power: Math.floor(move.power / 2) };
  }
  return move;
}

/** Synthesis, Moonlight and Morning Sun heal more in harsh sunlight and less in other weather */
const SUNLIGHT_HEALING = new Set(["synthesis", "moonlight", "morning-sun"]);

/** Percent of max HP a healing move restores in the current weather */
export function weatherHealing(move: MoveInfo, weather: Weather | null): number {
  const healing = move.healing ?? 0;
  if (SUNLIGHT_HEALING.has(move.name) && weather) return weather === "sun" ? 200 / 3 : 25;
  if (move.name === "shore-up" && weather === "sand") return 200 / 3;
  return healing;
}

/** A short description of a move's link to the weather, for move buttons */
export function weatherMoveNote(move: MoveInfo): string | null {
  const sets = WEATHER_MOVES[move.name];
  if (sets) return `Sets ${WEATHER_NAMES[sets].toLowerCase()} for ${WEATHER_TURNS} turns`;
  if (move.name === "weather-ball") return "Type and power change with weather";
  if (RAIN_SURE_HITS.has(move.name)) return "Never misses in rain";
  if (move.name === "blizzard") return "Never misses in hail or snow";
  if (SOLAR_MOVES.has(move.name)) return "Weaker outside sunlight";
  if (SUNLIGHT_HEALING.has(move.name)) return "Heals more in sunlight";
  return null;
}

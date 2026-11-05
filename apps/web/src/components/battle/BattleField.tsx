import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import {
  BOOST_STATS, FIELD_EFFECT_NAMES, abilityName, itemName, HAZARD_NAMES, SIDE_CONDITION_NAMES, TERRAIN_NAMES, WEATHER_NAMES, battleSprites,
  type BattleEvent, type BoostStat, type FieldEffect, type FieldState, type Hazard, type ShownCombatant, type SideCondition,
  type SideField, type SideIndex, type StatusCondition, type Weather,
} from "@pokedex/shared";
import { formatPokemonName } from "../../lib/format";

/** The arena is drawn at this logical size and scaled to fit its container */
const STAGE_WIDTH = 800;

const STATUS_LABELS: Record<StatusCondition, string> = {
  burn: "BRN",
  poison: "PSN",
  paralysis: "PAR",
  sleep: "SLP",
  freeze: "FRZ",
};

export function StatusPill({ status }: { status: StatusCondition | null }) {
  if (!status) return null;
  return (
    <span className={`status-pill status-${status}`} title={status}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function HpBar({ hp, maxHp, showNumbers }: { hp: number; maxHp: number; showNumbers: boolean }) {
  const percent = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const level = percent > 50 ? "high" : percent > 20 ? "mid" : "low";
  return (
    <div className="hp">
      <div className="hp-row">
        <span className="hp-label">HP</span>
        <div className="hp-track" role="meter" aria-label="HP" aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={hp}>
          <div className={`hp-fill ${level}`} style={{ width: `${percent}%` }} />
        </div>
      </div>
      {showNumbers && (
        <span className="hp-text">
          {hp} / {maxHp}
        </span>
      )}
    </div>
  );
}

/** How much sprites are enlarged on the stage, and how tall (in stage pixels) they may get */
const SPRITE_FIT = {
  top: { scale: 1.7, maxHeight: 175 },
  bottom: { scale: 2.1, maxHeight: 245 },
};

/** Sprites remount to restart animations, so remember their sizes to avoid a flicker */
const naturalHeights = new Map<string, number>();

export function BattleSprite({ spriteUrl, position, name }: { spriteUrl: string; position: "top" | "bottom"; name: string }) {
  const candidates = battleSprites(spriteUrl)[position === "bottom" ? "back" : "front"];
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState<number | null>(null);
  const naturalHeight = naturalHeights.get(candidates[index]) ?? loaded;
  // Without any back sprite, show the front one mirrored
  const mirrored = position === "bottom" && candidates.length > 1 && index === candidates.length - 1;
  const fit = SPRITE_FIT[position];
  const scale = naturalHeight ? Math.min(fit.scale, fit.maxHeight / naturalHeight) : fit.scale;

  return (
    <img
      className={mirrored ? "battle-sprite mirrored" : "battle-sprite"}
      src={candidates[index]}
      alt={formatPokemonName(name)}
      style={{ scale: String(scale), visibility: naturalHeight ? "visible" : "hidden" }}
      onLoad={(event) => {
        naturalHeights.set(candidates[index], event.currentTarget.naturalHeight);
        setLoaded(event.currentTarget.naturalHeight);
      }}
      onError={() => {
        setLoaded(null);
        setIndex((i) => Math.min(i + 1, candidates.length - 1));
      }}
    />
  );
}

export type FieldSide = {
  side: SideIndex;
  trainer: string;
  combatant: ShownCombatant;
  down: boolean;
  /** Which party members still stand, for the party balls */
  party: boolean[];
  showHpNumbers: boolean;
};

const STAT_SHORT: Record<BoostStat, string> = {
  attack: "Atk",
  defense: "Def",
  "special-attack": "SpA",
  "special-defense": "SpD",
  speed: "Spe",
  accuracy: "Acc",
  evasion: "Eva",
};

export function BoostChips({ boosts }: { boosts: ShownCombatant["boosts"] }) {
  const changed = BOOST_STATS.filter((stat) => (boosts[stat] ?? 0) !== 0);
  if (changed.length === 0) return null;
  return (
    <span className="boosts">
      {changed.map((stat) => {
        const stage = boosts[stat] ?? 0;
        return (
          <span key={stat} className={stage > 0 ? "boost up" : "boost down"}>
            {STAT_SHORT[stat]} {stage > 0 ? `+${stage}` : stage}
          </span>
        );
      })}
    </span>
  );
}

type Position = "top" | "bottom";
type Float = { text: string; tone: string };

function floatsFor(event: BattleEvent): Float[] {
  switch (event.kind) {
    case "damage": {
      const floats: Float[] = [{ text: `-${event.amount}`, tone: event.critical ? "damage big" : "damage" }];
      if (event.critical) floats.push({ text: "Critical hit!", tone: "crit" });
      if (event.effectiveness > 1) floats.push({ text: "Super effective!", tone: "super" });
      if (event.effectiveness < 1) floats.push({ text: "Not very effective…", tone: "weak" });
      return floats;
    }
    case "miss":
      return [{ text: "Miss!", tone: "miss" }];
    case "immune":
      return [{ text: "Immune", tone: "immune" }];
    case "status":
      return [{ text: { burn: "Burned!", poison: "Poisoned!", paralysis: "Paralyzed!", sleep: "Fell asleep!", freeze: "Frozen!" }[event.status], tone: `cond-${event.status}` }];
    case "status-damage":
      return [{ text: `-${event.amount}`, tone: `damage cond-${event.status}` }];
    case "weather-damage":
    case "leech":
    case "hazard-damage":
    case "hurt":
      return [{ text: `-${event.amount}`, tone: "damage" }];
    case "volatile":
      return event.float ? [{ text: event.float, tone: "weak" }] : [];
    case "ability":
      return event.ability ? [{ text: `[${abilityName(event.ability)}]`, tone: "ability" }] : [];
    case "item":
      return event.item ? [{ text: itemName(event.item), tone: "item" }] : [];
    case "substitute":
      return [{ text: event.active ? "Substitute!" : "Substitute broke!", tone: "protect" }];
    case "seeded":
      return event.seeded ? [{ text: "Seeded!", tone: "heal" }] : [];
    case "cant-move":
      return [{ text: { burn: "", poison: "", paralysis: "Can't move!", sleep: "Zzz…", freeze: "Frozen solid!" }[event.status], tone: `cond-${event.status}` }];
    case "cured":
      return [{ text: event.status === "sleep" ? "Woke up!" : "Thawed out!", tone: "cured" }];
    case "stat":
      if (event.change === 0) {
        return [{ text: `${STAT_SHORT[event.stat]} won't go ${event.attempted > 0 ? "higher" : "lower"}!`, tone: "weak" }];
      }
      return [{
        text: `${STAT_SHORT[event.stat]} ${(event.change > 0 ? "↑" : "↓").repeat(Math.abs(event.change))}`,
        tone: event.change > 0 ? "stat-up" : "stat-down",
      }];
    case "heal":
      return [{ text: `+${event.amount}`, tone: "heal" }];
    case "recoil":
      return [{ text: `-${event.amount}`, tone: "damage" }, { text: "Recoil", tone: "weak" }];
    case "fail":
      return [{ text: "Failed!", tone: "miss" }];
    case "protect":
      return [{ text: event.blocked ? "Blocked!" : "Protected!", tone: "protect" }];
    default:
      return [];
  }
}

function animationFor(event: BattleEvent | null, position: Position, eventPosition: Position): string {
  if (!event || position !== eventPosition) return "";
  switch (event.kind) {
    case "move":
      return "anim-lunge";
    case "damage":
      return "anim-hit";
    case "miss":
      return "anim-dodge";
    case "status":
    case "status-damage":
    case "cant-move":
      return `anim-status anim-${event.status}`;
    case "cured":
      return "anim-cured";
    case "faint":
      return "anim-faint";
    case "withdraw":
      return "anim-withdraw";
    case "switch":
      return "anim-switch";
    case "stat":
      return event.change > 0 ? "anim-stat-up" : event.change < 0 ? "anim-stat-down" : "";
    case "heal":
      return "anim-heal";
    case "recoil":
    case "weather-damage":
    case "leech":
    case "hazard-damage":
    case "hurt":
      return "anim-hit";
    case "substitute":
      return "anim-protect";
    case "haze":
      return "anim-cured";
    case "protect":
      return "anim-protect";
    default:
      return "";
  }
}

type Particles = StatusCondition | "stat-up" | "stat-down" | "heal";

const PARTICLE_TEXT: Partial<Record<Particles, string>> = { sleep: "Z", "stat-up": "▲", "stat-down": "▼", heal: "+" };

function particlesFor(event: BattleEvent | null): Particles | null {
  if (!event) return null;
  if (event.kind === "status" || event.kind === "status-damage" || event.kind === "cant-move") return event.status;
  if (event.kind === "stat" && event.change !== 0) return event.change > 0 ? "stat-up" : "stat-down";
  if (event.kind === "heal") return "heal";
  return null;
}

function PartyBalls({ party }: { party: boolean[] }) {
  return (
    <span className="party-balls" aria-label={`${party.filter(Boolean).length} of ${party.length} Pokémon left`}>
      {party.map((alive, index) => (
        <span key={index} className={alive ? "ball" : "ball out"} />
      ))}
    </span>
  );
}

/** A side's conditions (with turns left) and hazards (with layers) */
function SideChips({ sideField }: { sideField: SideField | undefined }) {
  if (!sideField) return null;
  const conditions = Object.entries(sideField.conditions) as [SideCondition, number][];
  const hazards = Object.entries(sideField.hazards) as [Hazard, number][];
  if (conditions.length === 0 && hazards.length === 0) return null;
  return (
    <span className="side-chips">
      {conditions.map(([condition, turns]) => (
        <span key={condition} className="side-chip condition" title={`${turns} turn${turns === 1 ? "" : "s"} left`}>
          {SIDE_CONDITION_NAMES[condition]} {turns}
        </span>
      ))}
      {hazards.map(([hazard, layers]) => (
        <span key={hazard} className="side-chip hazard">
          {HAZARD_NAMES[hazard]}
          {layers > 1 ? ` ×${layers}` : ""}
        </span>
      ))}
    </span>
  );
}

function InfoBox({ field, position, sideField }: { field: FieldSide; position: Position; sideField?: SideField }) {
  const { combatant } = field;
  // The side's conditions stay visible while the trainer picks the next Pokémon
  if (field.down) {
    return sideField && (Object.keys(sideField.conditions).length > 0 || Object.keys(sideField.hazards).length > 0) ? (
      <div className={`info-box info-${position} info-empty`}>
        <SideChips sideField={sideField} />
      </div>
    ) : null;
  }
  return (
    <div className={`info-box info-${position}`}>
      <div className="info-trainer">
        <span>{field.trainer}</span>
        <PartyBalls party={field.party} />
      </div>
      <div className="info-name">
        <strong>
          {formatPokemonName(combatant.name)}
          {combatant.gender && (
            <span className={`gender ${combatant.gender}`} aria-label={combatant.gender}>
              {combatant.gender === "female" ? " ♀" : " ♂"}
            </span>
          )}
        </strong>
        <StatusPill status={combatant.status} />
        <span className="info-level">Lv{combatant.level}</span>
      </div>
      <HpBar hp={combatant.hp} maxHp={combatant.maxHp} showNumbers={field.showHpNumbers} />
      <BoostChips boosts={combatant.boosts} />
      {(combatant.substitute || combatant.seeded || (combatant.tags?.length ?? 0) > 0) && (
        <span className="side-chips">
          {combatant.substitute && <span className="side-chip substitute">Substitute</span>}
          {combatant.seeded && <span className="side-chip seeded">Seeded</span>}
          {combatant.tags?.map((tag) => (
            <span key={tag} className="side-chip volatile">
              {tag}
            </span>
          ))}
        </span>
      )}
      <SideChips sideField={sideField} />
    </div>
  );
}

function Slot({
  field,
  position,
  event,
  eventKey,
}: {
  field: FieldSide;
  position: Position;
  event: BattleEvent | null;
  eventKey: string;
}) {
  const eventPosition: Position | null = event ? (event.side === field.side ? position : position === "top" ? "bottom" : "top") : null;
  const animation = eventPosition ? animationFor(event, position, eventPosition) : "";
  const mine = eventPosition === position && event !== null;
  const effect = mine ? particlesFor(event) : null;
  const leaving = mine && (event?.kind === "faint" || event?.kind === "withdraw");
  const floats = mine && event ? floatsFor(event).filter((float) => float.text) : [];
  const { combatant } = field;

  return (
    <div className={`slot slot-${position}`}>
      <div className="platform" />
      <div
        key={animation ? eventKey : "still"}
        className={`sprite-holder ${animation} ${field.down && !leaving ? "down" : ""} ${combatant.status ? `cond-${combatant.status}` : ""} ${combatant.substitute ? "behind-sub" : ""}`}
      >
        <BattleSprite key={combatant.spriteUrl} spriteUrl={combatant.spriteUrl} position={position} name={combatant.name} />
      </div>
      {effect && (
        <div key={`fx-${eventKey}`} className={`status-fx fx-${effect}`} aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} style={{ "--i": i } as CSSProperties}>
              {PARTICLE_TEXT[effect] ?? ""}
            </span>
          ))}
        </div>
      )}
      {floats.length > 0 && (
        <div key={`floats-${eventKey}`} className="floats" aria-hidden="true">
          {floats.map((float, i) => (
            <span key={i} className={`float ${float.tone}`} style={{ animationDelay: `${i * 160}ms` }}>
              {float.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function BattleField({
  top,
  bottom,
  event,
  eventKey,
  banner,
  weather = null,
  weatherTurns = null,
  field = null,
}: {
  top: FieldSide;
  bottom: FieldSide;
  event: BattleEvent | null;
  eventKey: string;
  banner?: string | null;
  weather?: Weather | null;
  /** Turns of weather left, shown when known */
  weatherTurns?: number | null;
  field?: FieldState | null;
}) {
  const arena = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const element = arena.current;
    if (!element) return;
    setScale(element.getBoundingClientRect().width / STAGE_WIDTH);
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / STAGE_WIDTH));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const shake = event?.kind === "damage" && (event.critical || event.effectiveness > 1);
  const terrain = field?.terrain ?? null;
  // Fairy Lock is shown through the switching message instead
  const effects = (Object.entries(field?.effects ?? {}) as [FieldEffect, number][]).filter(([effect]) => effect !== "fairy-lock");

  return (
    <div ref={arena} className="arena">
      <div className={shake ? "shaker shake" : "shaker"} key={shake ? eventKey : "still"}>
        <div className="stage" style={{ transform: `scale(${scale})` }}>
          <Slot field={top} position="top" event={event} eventKey={eventKey} />
          <Slot field={bottom} position="bottom" event={event} eventKey={eventKey} />
        </div>
      </div>
      {terrain && <div key={terrain.kind} className={`terrain-fx terrain-${terrain.kind}`} aria-hidden="true" />}
      {weather && <div key={weather} className={`weather-fx weather-${weather}`} aria-hidden="true" />}
      {(weather || terrain || effects.length > 0) && (
        <div className="field-chips">
          {weather && (
            <p className="weather-chip">
              {WEATHER_NAMES[weather]}
              {weatherTurns ? ` · ${weatherTurns} turn${weatherTurns === 1 ? "" : "s"} left` : ""}
            </p>
          )}
          {terrain && (
            <p className={`weather-chip terrain-chip-${terrain.kind}`}>
              {TERRAIN_NAMES[terrain.kind]} · {terrain.turnsLeft}
            </p>
          )}
          {effects.map(([effect, turns]) => (
            <p key={effect} className="weather-chip">
              {FIELD_EFFECT_NAMES[effect]} · {turns}
            </p>
          ))}
        </div>
      )}
      <InfoBox field={top} position="top" sideField={field?.sides[top.side]} />
      <InfoBox field={bottom} position="bottom" sideField={field?.sides[bottom.side]} />
      {banner && <p className="arena-banner">{banner}</p>}
    </div>
  );
}

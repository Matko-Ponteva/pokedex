import type { DraftMember } from "../lib/teamDraft";
import { usePokemon } from "../hooks/usePokemon";
import { TypeBadge } from "./TypeBadge";
import { formatMove } from "../lib/format";
import {
  ABILITY_DESCRIPTIONS, HELD_ITEMS, ITEM_CATEGORY_NAMES, LEARN_METHODS, LEARN_METHOD_NAMES, NATURE_NAMES, UNSUPPORTED_REASONS,
  abilityName, abilitySlug, hasStatusEffect, isUsableMove, natureLabel,
  type ItemCategory, type LearnMethod, type MoveInfo, type PokemonDetail,
} from "@pokedex/shared";

const ITEM_GROUPS = (Object.keys(ITEM_CATEGORY_NAMES) as ItemCategory[]).map((category) => ({
  category,
  items: Object.entries(HELD_ITEMS)
    .filter(([, item]) => item.category === category)
    .sort(([, a], [, b]) => a.name.localeCompare(b.name)),
}));

const MOVE_SLOTS = [0, 1, 2, 3];

/** The Pokémon's moves grouped by the first way it learns them: level up, then TM, then egg */
function movesByMethod(detail: PokemonDetail): [LearnMethod, string[]][] {
  const groups = new Map<LearnMethod, string[]>(LEARN_METHODS.map((method) => [method, []]));
  for (const move of detail.moves) groups.get(detail.learnMethods?.[move]?.[0] ?? "level-up")!.push(move);
  return [...groups].filter(([, moves]) => moves.length > 0);
}

type Props = {
  member: DraftMember;
  slot: number;
  isFirst: boolean;
  isLast: boolean;
  moveInfo?: Map<string, MoveInfo>;
  onChange: (change: Partial<Pick<DraftMember, "moves" | "ability" | "item" | "nature">>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
};

export function MemberCard({
  member, slot, isFirst, isLast, moveInfo, onChange, onMoveUp, onMoveDown, onRemove,
}: Props) {
  const { data: detail, isPending, isError } = usePokemon(String(member.pokemon.id));
  const { pokemon, moves } = member;
  const abilities = (detail?.abilities ?? []).map((ability) => ({ ...ability, slug: abilitySlug(ability.name) }));
  // Without a choice, the Pokémon battles with its first regular ability
  const ability = member.ability ?? (abilities.find((each) => !each.hidden) ?? abilities[0])?.slug ?? null;

  function setMove(index: number, value: string) {
    const next = MOVE_SLOTS.map((i) => (i === index ? value : moves[i] ?? ""));
    onChange({ moves: next.filter((move) => move !== "") });
  }

  return (
    <li className="member-card">
      <div className="member-header">
        <img src={pokemon.spriteUrl} alt="" width={72} height={72} />
        <div>
          <span className="number">Slot {slot}</span>
          <h3 className="name">{pokemon.name}</h3>
          <div className="card-types">
            {pokemon.types.map((type) => (
              <TypeBadge key={type} type={type} />
            ))}
          </div>
        </div>
      </div>

      <div className="build-grid">
        <label className="move-select">
          <span>Ability</span>
          <select
            value={ability ?? ""}
            disabled={isPending || isError || abilities.length === 0}
            onChange={(e) => onChange({ ability: e.target.value })}
          >
            {member.ability && !abilities.some((each) => each.slug === member.ability) && detail && (
              <option value={member.ability}>{abilityName(member.ability)} (not this Pokémon's)</option>
            )}
            {abilities.map((each) => (
              <option key={each.slug} value={each.slug}>
                {abilityName(each.slug)}
                {each.hidden ? " (hidden)" : ""}
              </option>
            ))}
          </select>
          {ability && (
            <span className={ABILITY_DESCRIPTIONS[ability] ? "move-info" : "field-error"}>
              {ABILITY_DESCRIPTIONS[ability] ?? "No effect in battles yet"}
            </span>
          )}
        </label>
        <label className="move-select">
          <span>Item</span>
          <select value={member.item ?? ""} onChange={(e) => onChange({ item: e.target.value || null })}>
            <option value="">None</option>
            {ITEM_GROUPS.map(({ category, items }) => (
              <optgroup key={category} label={ITEM_CATEGORY_NAMES[category]}>
                {items.map(([slug, item]) => (
                  <option key={slug} value={slug}>
                    {item.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {member.item && HELD_ITEMS[member.item] && <span className="move-info">{HELD_ITEMS[member.item].description}</span>}
        </label>
        <label className="move-select">
          <span>Nature</span>
          <select value={member.nature ?? "hardy"} onChange={(e) => onChange({ nature: e.target.value })}>
            {NATURE_NAMES.map((nature) => (
              <option key={nature} value={nature}>
                {natureLabel(nature)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="move-grid">
        {MOVE_SLOTS.map((i) => {
          const info = moves[i] ? moveInfo?.get(moves[i]) : undefined;
          const invalid = Boolean(detail && moves[i] && !detail.moves.includes(moves[i]));
          return (
            <label key={i} className="move-select">
              <span>Move {i + 1}</span>
              <select
                className={invalid ? "invalid" : undefined}
                aria-invalid={invalid}
                value={moves[i] ?? ""}
                disabled={isPending || isError || i > moves.length}
                onChange={(e) => setMove(i, e.target.value)}
              >
                <option value="">None</option>
                {invalid && (
                  <option value={moves[i]}>{formatMove(moves[i])} (can't be learned)</option>
                )}
                {detail &&
                  movesByMethod(detail).map(([method, learned]) => (
                    <optgroup key={method} label={LEARN_METHOD_NAMES[method]}>
                      {learned.map((move) => (
                        <option key={move} value={move} disabled={moves.includes(move) && moves[i] !== move}>
                          {formatMove(move)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
              </select>
              {info && (
                <span className="move-info">
                  <TypeBadge type={info.type} />
                  {info.category}
                  {info.power !== null && `, power ${info.power}`}
                  {(info.priority ?? 0) !== 0 && `, priority ${info.priority! > 0 ? "+" : ""}${info.priority}`}
                </span>
              )}
              {info && !isUsableMove(info) && (
                <span className="field-error">Not supported in battles yet</span>
              )}
              {info && UNSUPPORTED_REASONS[info.name] && isUsableMove(info) && (
                <span className="field-error">{UNSUPPORTED_REASONS[info.name]}</span>
              )}
              {info && info.category === "status" && !hasStatusEffect(info) && (
                <span className="field-error">Has no effect in battles yet</span>
              )}
            </label>
          );
        })}
      </div>
      {isError && <p className="field-error">Couldn't load this Pokémon's moves.</p>}

      <div className="member-actions">
        <button type="button" className="secondary" onClick={onMoveUp} disabled={isFirst}>
          Move up
        </button>
        <button type="button" className="secondary" onClick={onMoveDown} disabled={isLast}>
          Move down
        </button>
        <button type="button" className="danger" onClick={onRemove}>
          Remove
        </button>
      </div>
    </li>
  );
}
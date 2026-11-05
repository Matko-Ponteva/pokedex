import type { DraftMember } from "../lib/teamDraft";
import { usePokemon } from "../hooks/usePokemon";
import { TypeBadge } from "./TypeBadge";
import { formatMove } from "../lib/format";
import type { MoveInfo } from "@pokedex/shared";

const MOVE_SLOTS = [0, 1, 2, 3];

type Props = {
  member: DraftMember;
  slot: number;
  isFirst: boolean;
  isLast: boolean;
  moveInfo?: Map<string, MoveInfo>;
  onMovesChange: (moves: string[]) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
};

export function MemberCard({
  member, slot, isFirst, isLast, moveInfo, onMovesChange, onMoveUp, onMoveDown, onRemove,
}: Props) {
  const { data: detail, isPending, isError } = usePokemon(String(member.pokemon.id));
  const { pokemon, moves } = member;

  function setMove(index: number, value: string) {
    const next = MOVE_SLOTS.map((i) => (i === index ? value : moves[i] ?? ""));
    onMovesChange(next.filter((move) => move !== ""));
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
                  <option value={moves[i]}>{formatMove(moves[i])} (not learned by leveling)</option>
                )}
                {detail?.moves.map((move) => (
                  <option key={move} value={move} disabled={moves.includes(move) && moves[i] !== move}>
                    {formatMove(move)}
                  </option>
                ))}
              </select>
              {info && (
                <span className="move-info">
                  <TypeBadge type={info.type} />
                  {info.category}
                  {info.power !== null && `, power ${info.power}`}
                </span>
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
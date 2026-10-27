import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { teamInputSchema, type PokemonSummary, type Attacker } from "@pokedex/shared";
import { TextField } from "../components/TextField";
import { MemberCard } from "../components/MemberCard";
import { PokemonPicker } from "../components/PokemonPicker";
import { useSaveTeam, useTeam } from "../hooks/useTeams";
import {
  draftFromTeam, draftToInput, emptyDraft, type DraftMember, type TeamDraft,
} from "../lib/teamDraft";
import { toFieldErrors, type FieldErrors } from "../lib/formErrors";
import { DefenseTable } from "../components/DefenseTable";
import { CoverageGrid } from "../components/CoverageGrid";
import { useMoves } from "../hooks/useMoves";
import { useTypeCombinations } from "../hooks/useTypeCombinations";
import { TeamStatsChart } from "../components/TeamStatsChart";
import { usePokemonDetails } from "../hooks/usePokemonDetails";

const MAX_MEMBERS = 6;

export function TeamEditorPage() {
  const { id } = useParams();
  const teamId = id === undefined ? null : Number(id);
  const { data: team, isPending, isError } = useTeam(teamId);

  if (teamId !== null) {
    if (isPending) return <p className="status">Loading…</p>;
    if (isError) {
      return (
        <main className="status">
          <p>This team doesn't exist, or it isn't yours.</p>
          <Link to="/teams">Back to my teams</Link>
        </main>
      );
    }
  }

  return (
    <TeamEditor
      key={teamId ?? "new"}
      teamId={teamId}
      initial={team ? draftFromTeam(team) : emptyDraft}
    />
  );
}

type EditorProps = { teamId: number | null; initial: TeamDraft };

function TeamEditor({ teamId, initial }: EditorProps) {
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const save = useSaveTeam();
  const navigate = useNavigate();
  const isFull = draft.members.length >= MAX_MEMBERS;
  const moveNames = draft.members.flatMap((m) => m.moves);
  const { data: moveInfo } = useMoves(moveNames);
  const { data: combinations } = useTypeCombinations();

  const attackers: Attacker[] = draft.members.map((member) => ({
    types: member.pokemon.types,
    moves: member.moves.flatMap((name) => {
      const info = moveInfo?.get(name);
      return info ? [info] : [];
    }),
  }));

  const detailResults = usePokemonDetails(draft.members.map((m) => m.pokemon.id));
  const statMembers = draft.members.flatMap((member, index) => {
  const detail = detailResults[index]?.data;
    return detail ? [{ key: member.key, detail }] : [];
  });

  function addMember(pokemon: PokemonSummary) {
    setDraft((d) => {
      if (d.members.length >= MAX_MEMBERS) return d;
      const member: DraftMember = { key: crypto.randomUUID(), pokemon, moves: [] };
      return { ...d, members: [...d.members, member] };
    });
  }

  function changeMoves(key: string, moves: string[]) {
    setDraft((d) => ({
      ...d,
      members: d.members.map((m) => (m.key === key ? { ...m, moves } : m)),
    }));
  }

  function removeMember(key: string) {
    setDraft((d) => ({ ...d, members: d.members.filter((m) => m.key !== key) }));
  }

  function moveMember(index: number, offset: -1 | 1) {
    setDraft((d) => {
      const members = [...d.members];
      const target = index + offset;
      [members[index], members[target]] = [members[target], members[index]];
      return { ...d, members };
    });
  }

  function submit() {
    const result = teamInputSchema.safeParse(draftToInput(draft));
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      return;
    }
    setErrors({});
    save.mutate({ id: teamId, input: result.data }, { onSuccess: () => navigate("/teams") });
  }

  return (
    <main>
      <Link to="/teams" className="back">← Back to my teams</Link>
      <h1>{teamId === null ? "New team" : "Edit team"}</h1>

      <div className="editor-layout">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <TextField
            label="Team name"
            name="name"
            value={draft.name}
            error={errors.name}
            onChange={(name) => setDraft((d) => ({ ...d, name }))}
          />

          <h2>Members ({draft.members.length}/{MAX_MEMBERS})</h2>
          {draft.members.length === 0 && <p className="muted">Add Pokémon with the search on the right.</p>}
          <ol className="member-list">
            {draft.members.map((member, index) => (
              <MemberCard
                key={member.key}
                member={member}
                slot={index + 1}
                isFirst={index === 0}
                isLast={index === draft.members.length - 1}
                onMovesChange={(moves) => changeMoves(member.key, moves)}
                onMoveUp={() => moveMember(index, -1)}
                onMoveDown={() => moveMember(index, 1)}
                onRemove={() => removeMember(member.key)}
                moveInfo={moveInfo}
              />
            ))}
          </ol>
          {errors.members && <p className="field-error">{errors.members}</p>}
          {save.error && <p className="form-error" role="alert">{save.error.message}</p>}

          <button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save team"}
          </button>
        </form>

        <PokemonPicker disabled={isFull} onPick={addMember} />
      </div>
        <TeamStatsChart members={statMembers} />
      <DefenseTable members={draft.members.map((m) => m.pokemon)} />
    {draft.members.length > 0 && <CoverageGrid team={attackers} combinations={combinations} />}
    </main>
  );
}
import { useState } from "react";
import type { ChallengeInfo, OnlineUser } from "@pokedex/shared";
import { useTeams } from "../hooks/useTeams";
import { socket } from "../realtime/socket";

const ACK_TIMEOUT_MS = 5000;
const NO_ANSWER = "No answer from the server. Check your connection and try again.";

function TeamSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { data: teams } = useTeams();
  const usable = (teams ?? []).filter((team) => team.members.length > 0);

  if (teams && usable.length === 0) {
    return <p className="muted">You need a team with at least one Pokémon to battle.</p>;
  }

  return (
    <label className="move-select">
      <span>Battle with</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose a team</option>
        {usable.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name} ({team.members.length} Pokémon)
          </option>
        ))}
      </select>
    </label>
  );
}

export function ChallengeForm({ to, onClose }: { to: OnlineUser; onClose: () => void }) {
  const [teamId, setTeamId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function send() {
    if (!teamId) return;
    setSending(true);
    setError(null);
    try {
      const result = await socket
        .timeout(ACK_TIMEOUT_MS)
        .emitWithAck("battle:challenge", { toUserId: to.id, teamId: Number(teamId) });
      if (result.ok) onClose();
      else setError(result.error);
    } catch {
      setError(NO_ANSWER);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="trade-card">
      <p>Challenge {to.displayName} to a battle:</p>
      <TeamSelect value={teamId} onChange={setTeamId} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="trade-actions">
        <button type="button" onClick={send} disabled={!teamId || sending}>
          {sending ? "Sending…" : "Send challenge"}
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export function IncomingChallengeCard({ challenge }: { challenge: ChallengeInfo }) {
  const [teamId, setTeamId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function answer(accept: boolean) {
    setBusy(true);
    setError(null);
    try {
      const result = await socket.timeout(ACK_TIMEOUT_MS).emitWithAck("battle:respond", {
        challengeId: challenge.id,
        accept,
        teamId: accept ? Number(teamId) : undefined,
      });
      if (!result.ok) setError(result.error);
    } catch {
      setError(NO_ANSWER);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="trade-card incoming">
      <p>
        <strong>{challenge.from.displayName}</strong> challenges you to a battle!
      </p>
      <TeamSelect value={teamId} onChange={setTeamId} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="trade-actions">
        <button type="button" onClick={() => answer(true)} disabled={!teamId || busy}>
          {busy ? "Starting…" : "Accept"}
        </button>
        <button type="button" className="secondary" onClick={() => answer(false)} disabled={busy}>
          Decline
        </button>
      </div>
    </div>
  );
}

export function OutgoingChallengeCard({ challenge }: { challenge: ChallengeInfo }) {
  return (
    <div className="trade-card">
      <p>
        You challenged <strong>{challenge.to.displayName}</strong>. Waiting for an answer; challenges
        expire after a minute.
      </p>
    </div>
  );
}
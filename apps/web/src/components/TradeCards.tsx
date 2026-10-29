import { useState } from "react";
import type { MemberRef, OnlineUser, TradeOffer } from "@pokedex/shared";
import { useTeams } from "../hooks/useTeams";
import { formatPokemonName } from "../lib/format";
import { socket } from "../realtime/socket";

const ACK_TIMEOUT_MS = 5000;
const NO_ANSWER = "No answer from the server. Check your connection and try again.";

function parseMember(value: string): MemberRef | null {
  const [teamId, slot] = value.split(":").map(Number);
  return teamId && slot ? { teamId, slot } : null;
}

function MemberSelect({
  label, value, onChange,
}: { label: string; value: string; onChange: (value: string) => void }) {
  const { data: teams } = useTeams();
  const options = (teams ?? []).flatMap((team) =>
    team.members.map((member) => ({
      value: `${team.id}:${member.slot}`,
      label: `${formatPokemonName(member.pokemon.name)} (${team.name})`,
    }))
  );

  if (teams && options.length === 0) {
    return <p className="muted">You need a team with at least one Pokémon to trade.</p>;
  }

  return (
    <label className="move-select">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose a Pokémon</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function OfferForm({ to, onClose }: { to: OnlineUser; onClose: () => void }) {
  const [member, setMember] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const ref = parseMember(member);

  async function send() {
    if (!ref) return;
    setSending(true);
    setError(null);
    try {
      const result = await socket
        .timeout(ACK_TIMEOUT_MS)
        .emitWithAck("trade:offer", { toUserId: to.id, ...ref });
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
      <p>Offer {to.displayName} one of your Pokémon:</p>
      <MemberSelect label="You give" value={member} onChange={setMember} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="trade-actions">
        <button type="button" onClick={send} disabled={!ref || sending}>
          {sending ? "Sending…" : "Send offer"}
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export function IncomingTradeCard({ offer }: { offer: TradeOffer }) {
  const [member, setMember] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const ref = parseMember(member);

  async function accept() {
    if (!ref) return;
    setAccepting(true);
    setError(null);
    try {
      const result = await socket
        .timeout(ACK_TIMEOUT_MS)
        .emitWithAck("trade:accept", { offerId: offer.id, ...ref });
      if (!result.ok) setError(result.error);
    } catch {
      setError(NO_ANSWER);
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="trade-card incoming">
      <div className="trade-pokemon">
        <img src={offer.pokemon.spriteUrl} alt="" width={56} height={56} />
        <p>
          <strong>{offer.from.displayName}</strong> offers{" "}
          <strong>{formatPokemonName(offer.pokemon.name)}</strong> from {offer.teamName}.
        </p>
      </div>
      <MemberSelect label="You give in return" value={member} onChange={setMember} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="trade-actions">
        <button type="button" onClick={accept} disabled={!ref || accepting}>
          {accepting ? "Trading…" : "Accept"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => socket.emit("trade:decline", { offerId: offer.id })}
        >
          Decline
        </button>
      </div>
    </div>
  );
}

export function OutgoingTradeCard({ offer }: { offer: TradeOffer }) {
  return (
    <div className="trade-card">
      <div className="trade-pokemon">
        <img src={offer.pokemon.spriteUrl} alt="" width={56} height={56} />
        <p>
          You offered <strong>{formatPokemonName(offer.pokemon.name)}</strong> to{" "}
          <strong>{offer.to.displayName}</strong>. Waiting for an answer; offers expire after a minute.
        </p>
      </div>
      <div className="trade-actions">
        <button
          type="button"
          className="secondary"
          onClick={() => socket.emit("trade:cancel", { offerId: offer.id })}
        >
          Cancel offer
        </button>
      </div>
    </div>
  );
}
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CHAT_MAX_LENGTH, parseChatCommand, type ChatMessage, type ChatMode } from "@pokedex/shared";

type Note = { id: string; text: string };

function logTone(line: string): string {
  if (/^Turn \d+$/.test(line)) return "turn";
  if (/wins the battle|won the battle/.test(line)) return "win";
  if (/fainted!/.test(line)) return "faint";
  if (/critical hit|super effective/i.test(line)) return "strong";
  if (/not very effective|doesn't affect|avoided the attack|But it failed|nothing happened|won't go any|is already|HP is full/i.test(line)) return "weak";
  if (/ (rose|rose sharply|rose drastically)!$/.test(line)) return "stat-up";
  if (/ (fell|harshly fell|severely fell)!$/.test(line)) return "stat-down";
  if (/regained health|energy drained/.test(line)) return "heal";
  if (/burn|poison|paraly|asleep|sleep|frozen|thawed|woke up/i.test(line)) return "condition";
  if (/sent out|withdrew|start a battle/.test(line)) return "switch";
  if (/connection|ran out of time|forfeit|is back|didn't come back/.test(line)) return "system";
  return "";
}

function useStickToBottom<T>(dependency: T) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [dependency]);
  return ref;
}

export function BattleSidebar({
  log,
  chat,
  myUserId,
  playerIds,
  mode,
  spectators,
  onSend,
  onModeChange,
}: {
  log: string[];
  chat: ChatMessage[];
  myUserId: number | undefined;
  /** Battlers in side order, for the P1 / P2 tags */
  playerIds: [number, number];
  /** Your chat privacy, or null when you are spectating */
  mode: ChatMode | null;
  spectators: number;
  onSend: (text: string) => Promise<string | null>;
  onModeChange?: (mode: ChatMode) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const logRef = useStickToBottom(log.length);
  const chatRef = useStickToBottom(chat.length + notes.length);

  const note = (text: string) => setNotes((current) => [...current, { id: crypto.randomUUID(), text }].slice(-5));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    const command = parseChatCommand(text);
    if (text.startsWith("/") && !command) {
      note("Unknown command. Battlers can type /public or /private.");
      return;
    }

    setSending(true);
    let error: string | null;
    if (command) {
      if (mode === null || !onModeChange) {
        error = "Only the battlers can make their chat private or public.";
      } else {
        error = await onModeChange(command);
        if (!error) {
          note(
            command === "private"
              ? "Your chat is private: you only see messages from your opponent."
              : "Your chat is public: you see spectators' messages too."
          );
        }
      }
    } else {
      error = await onSend(text);
    }
    setSending(false);
    if (error) note(error);
    else setDraft("");
  }

  const roleTag = (message: ChatMessage) => {
    if (message.role === "spectator") return "Spectator";
    return message.from.id === playerIds[0] ? "P1" : "P2";
  };

  return (
    <aside className="battle-sidebar">
      <section className="sidebar-panel sidebar-log" aria-labelledby="battle-log-title">
        <header>
          <h2 id="battle-log-title">Battle log</h2>
        </header>
        <ol className="battle-log" ref={logRef} aria-live="polite">
          {log.map((line, index) => (
            <li key={index} className={logTone(line)}>
              {line}
            </li>
          ))}
        </ol>
      </section>

      <section className="sidebar-panel sidebar-chat" aria-labelledby="battle-chat-title">
        <header>
          <h2 id="battle-chat-title">Chat</h2>
          <span className="muted">{spectators === 1 ? "1 spectator" : `${spectators} spectators`}</span>
          {mode && (
            <span className={`chat-mode ${mode}`} title={mode === "private" ? "Type /public to see spectators" : "Type /private to hide spectators"}>
              {mode}
            </span>
          )}
        </header>
        <ol className="chat-messages" ref={chatRef}>
          {chat.length === 0 && notes.length === 0 && (
            <li className="chat-note">
              {mode ? "Say hi! Type /private to only see your opponent, /public to see spectators too." : "Cheer on the battlers!"}
            </li>
          )}
          {chat.map((message) => (
            <li key={message.id} className={`chat-message ${message.role}${message.from.id === myUserId ? " own" : ""}`}>
              <span className="chat-tag">{roleTag(message)}</span>
              <strong>{message.from.displayName}</strong> <span className="chat-text">{message.text}</span>
            </li>
          ))}
          {notes.map((item) => (
            <li key={item.id} className="chat-note">
              {item.text}
            </li>
          ))}
        </ol>
        <form className="chat-form" onSubmit={submit}>
          <input
            aria-label="Chat message"
            placeholder={mode ? "Message, /public or /private" : "Message"}
            value={draft}
            maxLength={CHAT_MAX_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" disabled={sending || draft.trim() === ""}>
            Send
          </button>
        </form>
      </section>
    </aside>
  );
}

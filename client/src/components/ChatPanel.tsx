import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@spark/shared";
import { api, type WorldSummary } from "../api";
import { useAuth } from "../AuthContext";
import { useWorldLiveChannel } from "../useWorldLiveChannel";
import { timeAgo } from "./DiceRoller";

export function ChatPanel({ worldId, worlds }: { worldId: string; worlds: WorldSummary[] }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const { error: liveError } = useWorldLiveChannel(worldId, { onChat: setMessages });
  const isOwner = worlds.find((w) => w.id === worldId)?.isOwner ?? false;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await api.postChatMessage({ worldId, text: text.trim() });
      setText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteChatMessage(id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="panel chat-panel">
      <h3 className="section-heading">Party Chat</h3>
      {liveError && <p className="hint">{liveError}</p>}
      {messages.length === 0 && <p className="hint">No messages yet — say hello.</p>}
      <ul className="chat-panel-messages" ref={listRef}>
        {messages.map((m) => {
          const canDelete = m.userId === user?.id || isOwner;
          return (
            <li key={m.id} className="dice-history-row chat-message-row">
              <div className="dice-history-main">
                <span className="entity-name">
                  {m.senderName}
                  <span className="dice-history-time"> · {timeAgo(new Date(m.createdAt).getTime())}</span>
                </span>
                {canDelete && (
                  <button className="dice-history-delete" onClick={() => handleDelete(m.id)} aria-label={`Delete message from ${m.senderName}`}>×</button>
                )}
              </div>
              <span className="chat-message-text">{m.text}</span>
            </li>
          );
        })}
      </ul>
      {error && <p className="error">{error}</p>}
      <form className="chat-input-row" onSubmit={handleSend}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message the party…"
          maxLength={2000}
        />
        <button className="btn-primary" type="submit" disabled={sending || !text.trim()}>Send</button>
      </form>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@spark/shared";
import { RECENT_HISTORY_LIMIT } from "@spark/shared";
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

  const [historyOpen, setHistoryOpen] = useState(false);
  const [olderMessages, setOlderMessages] = useState<ChatMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyExhausted, setHistoryExhausted] = useState(false);
  const isPaid = user?.tier === "paid";

  const { error: liveError } = useWorldLiveChannel(worldId, { onChat: setMessages });
  const isOwner = worlds.find((w) => w.id === worldId)?.isOwner ?? false;

  useEffect(() => {
    // A world switch invalidates any loaded older history.
    setHistoryOpen(false);
    setOlderMessages([]);
    setHistoryExhausted(false);
    setHistoryError(null);
  }, [worldId]);

  async function loadOlderMessages() {
    if (!worldId || historyLoading) return;
    // messages is oldest-first (live display order); the oldest currently
    // visible message is the correct starting cursor for "older than this".
    const cursor = olderMessages.length > 0 ? olderMessages[olderMessages.length - 1].id : messages[0]?.id;
    if (!cursor) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const rows = await api.loadOlderChat(worldId, cursor);
      if (rows.length === 0) setHistoryExhausted(true);
      setOlderMessages((prev) => [...prev, ...rows]);
    } catch (e) {
      setHistoryError((e as Error).message);
    } finally {
      setHistoryLoading(false);
    }
  }

  function toggleHistory() {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setHistoryOpen(true);
    if (isPaid && olderMessages.length === 0 && !historyExhausted) loadOlderMessages();
  }

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

      <div className="button-row">
        <button className="btn-secondary" onClick={toggleHistory} aria-expanded={historyOpen}>
          {historyOpen ? "Hide Full History" : "View Full History"}
        </button>
      </div>

      {historyOpen && !isPaid && (
        <p className="hint">Full history beyond the last {RECENT_HISTORY_LIMIT} messages is a paid feature — see Billing to upgrade.</p>
      )}

      {historyOpen && isPaid && (
        <>
          <ul className="chat-panel-messages older-history">
            {olderMessages.map((m) => (
              <li key={m.id} className="dice-history-row chat-message-row">
                <span className="entity-name">
                  {m.senderName}
                  <span className="dice-history-time"> · {timeAgo(new Date(m.createdAt).getTime())}</span>
                </span>
                <span className="chat-message-text">{m.text}</span>
              </li>
            ))}
          </ul>
          {historyError && <p className="error">{historyError}</p>}
          {!historyExhausted && (
            <button className="btn-secondary" onClick={loadOlderMessages} disabled={historyLoading}>
              {historyLoading ? "Loading…" : "Load More"}
            </button>
          )}
          {historyExhausted && olderMessages.length === 0 && <p className="hint">No older messages.</p>}
          {historyExhausted && olderMessages.length > 0 && <p className="hint">That's the full history.</p>}
        </>
      )}

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

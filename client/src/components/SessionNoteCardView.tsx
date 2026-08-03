import type { SessionNote, SessionNoteInput } from "@spark/shared";

export function SessionNoteCardView({ note }: { note: SessionNote | SessionNoteInput }) {
  return (
    <div className="statblock item-card">
      <h2 className="statblock-name">{note.title}</h2>
      {note.sessionLabel && <p className="statblock-subtitle">{note.sessionLabel}</p>}
      <hr className="rule gold" />
      <h3 className="section-heading">Summary</h3>
      <p>{note.summary}</p>
      {note.looseThreads && <><h3 className="section-heading">Loose Threads</h3><p>{note.looseThreads}</p></>}
      {note.nextSteps && <><h3 className="section-heading">Next Steps</h3><p>{note.nextSteps}</p></>}
    </div>
  );
}

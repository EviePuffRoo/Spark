import type { GeneratedQuestHook, QuestStatus } from "@spark/shared";
import { QUEST_STATUS_LABELS } from "@spark/shared";

export function QuestHookCardView({ quest }: { quest: GeneratedQuestHook & { status?: QuestStatus } }) {
  return (
    <div className="statblock item-card">
      <h2 className="statblock-name">{quest.title}</h2>
      <p className="statblock-subtitle">
        {quest.questType} &middot; {quest.tier}
        {quest.status && <span className={`status-badge status-${quest.status}`}>{QUEST_STATUS_LABELS[quest.status]}</span>}
      </p>
      <hr className="rule gold" />
      <h3 className="section-heading">Hook</h3>
      <p>{quest.hook}</p>
      <h3 className="section-heading">Objective</h3>
      <p>{quest.objective}</p>
      <h3 className="section-heading">Complication</h3>
      <p>{quest.complication}</p>
      <h3 className="section-heading">Reward</h3>
      <p>{quest.reward}</p>
    </div>
  );
}

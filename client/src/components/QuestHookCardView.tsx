import type { GeneratedQuestHook } from "@spark/shared";

export function QuestHookCardView({ quest }: { quest: GeneratedQuestHook }) {
  return (
    <div className="statblock item-card">
      <h2 className="statblock-name">{quest.title}</h2>
      <p className="statblock-subtitle">{quest.questType} &middot; {quest.tier}</p>
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

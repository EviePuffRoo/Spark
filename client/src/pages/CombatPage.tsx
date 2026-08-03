import { DiceRoller } from "../components/DiceRoller";
import { InitiativeTracker } from "../components/InitiativeTracker";

export function CombatPage() {
  return (
    <div className="page generator-layout">
      <DiceRoller />
      <InitiativeTracker />
    </div>
  );
}

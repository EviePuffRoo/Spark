import { describe, it, expect } from "vitest";
import { parseStatBlockAttacks } from "./statBlockAttacks.js";
import { MONSTER_TEMPLATES } from "./data/monsterTemplates.js";
import { NPC_TEMPLATES } from "./data/npcTemplates.js";

describe("parseStatBlockAttacks", () => {
  it("parses a simple melee weapon attack", () => {
    const [attack] = parseStatBlockAttacks([
      { name: "Bite", description: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 4 (1d4+2) piercing damage." },
    ]);
    expect(attack).toEqual({
      name: "Bite", toHitBonus: 4, damageDice: "1d4+2", damageType: "piercing", savingThrow: null,
    });
  });

  it("parses a negative to-hit and negative damage modifier", () => {
    const [attack] = parseStatBlockAttacks([
      { name: "Club", description: "Melee Weapon Attack: +0 to hit, reach 5 ft., one target. Hit: 1 (1d4-1) bludgeoning damage." },
    ]);
    expect(attack.toHitBonus).toBe(0);
    expect(attack.damageDice).toBe("1d4-1");
  });

  it("parses an attack roll plus a secondary saving throw", () => {
    const [attack] = parseStatBlockAttacks([
      {
        name: "Bite",
        description: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (2d4+2) piercing damage. If the target is a creature, it must succeed on a DC 11 Strength saving throw or be knocked prone.",
      },
    ]);
    expect(attack.toHitBonus).toBe(4);
    expect(attack.damageDice).toBe("2d4+2");
    expect(attack.savingThrow).toEqual({ ability: "str", dc: 11 });
  });

  it("skips actions with no attack roll or saving throw (Multiattack, pure flavor)", () => {
    const parsed = parseStatBlockAttacks([
      { name: "Multiattack", description: "The wolf makes two attacks: one with its bite and one with its claws." },
      { name: "Pack Tactics", description: "The wolf has advantage on an attack roll against a creature if an ally is within 5 ft." },
    ]);
    expect(parsed).toEqual([]);
  });

  it("parses every action across the real monster and NPC template data without missing a to-hit, damage, or saving throw", () => {
    for (const template of [...MONSTER_TEMPLATES, ...NPC_TEMPLATES]) {
      for (const action of template.statBlock.actions) {
        const hasToHitText = /to hit/i.test(action.description);
        const hasSaveText = /saving throw/i.test(action.description);
        const [parsed] = parseStatBlockAttacks([action]);
        if (hasToHitText) {
          expect(parsed?.toHitBonus, `${template.name} — ${action.name}`).not.toBeNull();
          expect(parsed?.damageDice, `${template.name} — ${action.name}`).not.toBeNull();
        }
        if (hasSaveText) {
          expect(parsed?.savingThrow, `${template.name} — ${action.name}`).not.toBeNull();
        }
      }
    }
  });
});

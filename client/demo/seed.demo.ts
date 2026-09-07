import { test } from "@playwright/test";
import { demoWorldIsLive, seedDemoWorld, DEMO_STATE_PATH } from "./demoWorld";

// Runs before every segment (see playwright.demo.config.ts's dependencies).
//
// Idempotent on purpose: if showcase-out/demo-world.json still names a world
// this server can serve, it is reused untouched. That is what makes a segment
// independently re-shootable — re-recording the map builder a week later
// lands on the same party, the same maps and the same names the combat
// segment was shot against.
//
// SPARK_DEMO_RESEED=1 forces a fresh world.
test("seed the demo world", async ({ browser }) => {
  const dmContext = await browser.newContext({ baseURL: "http://localhost:5200" });
  const playerContext = await browser.newContext({ baseURL: "http://localhost:5200" });

  try {
    if (!process.env.SPARK_DEMO_RESEED) {
      const existing = await demoWorldIsLive(dmContext.request);
      if (existing) {
        console.log(`  reusing "${existing.worldName}" seeded ${existing.seededAt}`);
        console.log(`  ${DEMO_STATE_PATH}`);
        return;
      }
    }

    const state = await seedDemoWorld(dmContext.request, playerContext.request);
    console.log(`  seeded "${state.worldName}"`);
    console.log(`    DM      ${state.dm.username} (${state.dm.displayName})`);
    console.log(`    player  ${state.player.username} (${state.player.displayName})`);
    console.log(`    party   ${Object.keys(state.playerCharacterIds).join(", ")}`);
    console.log(`    foes    ${Object.keys(state.monsterIds).join(", ")}`);
    console.log(`  ${DEMO_STATE_PATH}`);
  } finally {
    await dmContext.close();
    await playerContext.close();
  }
});

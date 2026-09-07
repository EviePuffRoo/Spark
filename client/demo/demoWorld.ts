import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import type { APIRequestContext } from "@playwright/test";
import type { PlacedTile } from "@spark/shared";

// The demo world every showcase segment is shot against.
//
// Why this exists at all: recording the app is cheap, but recording an app
// with nothing in it is worthless — an empty roster and a world called
// "Test Zone 1" reads as a prototype no matter how good the software is.
// Believable content across every screen is the expensive part of a product
// video, so it lives here once, as data, rather than being rebuilt through
// the UI on every take.
//
// Two rules this file follows, both learned the hard way (see CLAUDE.md):
//
//   1. Everything is created through the HTTP API, never by writing to
//      e2e.db directly. Direct DB writes bypass the routes' coercion, and
//      the failure mode is a screen that crashes on a field the API would
//      have defaulted — which looks exactly like a product bug on camera.
//   2. Nothing here calls a generator. The content generators use
//      Math.random, so a re-shoot would silently rename the party and break
//      continuity with segments shot earlier. Generation is a thing the
//      video *shows*, not a thing it depends on.
//
// The result is written to showcase-out/demo-world.json, so a segment can be
// re-shot on its own against the same world days later. That independence is
// what keeps a 3-minute tour tractable: one flaky beat costs one clip.

// Resolved from the working directory rather than the module's own path:
// this package is ESM ("type": "module"), so __dirname does not exist, and
// import.meta is not safe across Playwright's transpile. The demo is run
// from client/ (npm run demo) but tolerate the repo root too.
const CLIENT_DIR = process.cwd().endsWith(`${sep}client`) ? process.cwd() : resolve(process.cwd(), "client");
export const DEMO_STATE_PATH = resolve(CLIENT_DIR, "showcase-out/demo-world.json");

export interface DemoWorld {
  seededAt: string;
  password: string;
  dm: { username: string; displayName: string };
  player: { username: string; displayName: string };
  worldId: string;
  worldName: string;
  // The finished map combat is shot on.
  battleMapId: string;
  // The deliberately unfinished map the builder segment completes on camera.
  draftBattleMapId: string;
  playerCharacterIds: Record<string, string>;
  monsterIds: Record<string, string>;
  dungeonId?: string;
}

const PASSWORD = "spark-demo-2026";

// ---------------------------------------------------------------------------
// The cast
// ---------------------------------------------------------------------------

const PARTY = [
  {
    name: "Brannoc Duskbarrow", className: "Fighter", level: 5, race: "Dwarf",
    armorClass: 18, maxHp: 47, playerName: "Rowan",
    abilityScores: { str: 17, dex: 12, con: 16, int: 9, wis: 12, cha: 10 },
    preparedSpells: [] as string[],
  },
  {
    name: "Sable Wren", className: "Rogue", level: 5, race: "Halfling",
    armorClass: 15, maxHp: 38, playerName: "Imogen",
    abilityScores: { str: 9, dex: 18, con: 13, int: 13, wis: 12, cha: 14 },
    preparedSpells: [] as string[],
  },
  {
    name: "Maerwyn Ashgrove", className: "Wizard", level: 5, race: "Human",
    armorClass: 12, maxHp: 32, playerName: "Tobias",
    abilityScores: { str: 8, dex: 14, con: 12, int: 18, wis: 11, cha: 10 },
    preparedSpells: ["fire-bolt", "magic-missile", "hold-person", "fireball"],
  },
  {
    name: "Ilesha Fenn", className: "Cleric", level: 5, race: "Half-Elf",
    armorClass: 18, maxHp: 41, playerName: "Nadia",
    abilityScores: { str: 13, dex: 10, con: 14, int: 11, wis: 17, cha: 13 },
    preparedSpells: ["sacred-flame", "cure-wounds", "healing-word"],
  },
];

function statBlock(over: Record<string, unknown>) {
  return {
    size: "Medium", creatureType: "humanoid", alignment: "chaotic evil",
    armorClass: 14, hitPointsAverage: 26, hitDiceFormula: "4d8 + 8",
    speed: "30 ft.",
    abilityScores: { str: 14, dex: 13, con: 14, int: 8, wis: 10, cha: 9 },
    senses: "darkvision 60 ft., passive Perception 10",
    languages: "Common",
    challengeRating: "1", proficiencyBonus: 2, xp: 200,
    traits: [], actions: [],
    ...over,
  };
}

const backstory = (role: string) => ({
  occupationOrRole: role,
  personalityTrait: "Speaks only to threaten, and means every word of it.",
  ideal: "The deep places were promised to us.",
  bond: "Sworn to the thing that sleeps beneath the bell.",
  flaw: "Will not retreat while the bell still hangs.",
});

const MONSTERS = [
  {
    name: "Vessa Coldmourn", templateId: "cultist", templateName: "Cult Fanatic",
    race: "Human", alignment: "lawful evil",
    statBlock: statBlock({
      armorClass: 13, hitPointsAverage: 44, hitDiceFormula: "8d8 + 8",
      abilityScores: { str: 11, dex: 14, con: 12, int: 10, wis: 14, cha: 13 },
      challengeRating: "2", xp: 450,
      skills: "Deception +4, Persuasion +4",
      senses: "passive Perception 12",
      traits: [{ name: "Dark Devotion", description: "Advantage on saving throws against being charmed or frightened." }],
      actions: [
        { name: "Dagger", description: "Melee or Ranged Weapon Attack: +4 to hit, reach 5 ft. or range 20/60 ft., one creature. Hit: 4 (1d4 + 2) piercing damage." },
        { name: "Spellcasting", description: "Casts inflict wounds, hold person, or sacred flame using Wisdom (spell save DC 12)." },
      ],
    }),
    backstory: backstory("Bell-keeper of the drowned chapel"),
  },
  {
    name: "Grix", templateId: "goblin", templateName: "Goblin Boss",
    race: "Goblinoid", alignment: "neutral evil",
    statBlock: statBlock({
      size: "Small", armorClass: 17, hitPointsAverage: 21, hitDiceFormula: "6d6",
      abilityScores: { str: 10, dex: 14, con: 10, int: 10, wis: 8, cha: 10 },
      challengeRating: "1", xp: 200, speed: "30 ft.",
      languages: "Common, Goblin",
      traits: [{ name: "Nimble Escape", description: "Takes the Disengage or Hide action as a bonus action on each of its turns." }],
      actions: [{ name: "Scimitar", description: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage." }],
    }),
    backstory: backstory("Warband captain squatting in the ruin"),
  },
  {
    name: "Drowned Acolyte", templateId: "zombie", templateName: "Zombie",
    race: "Undead", alignment: "neutral evil",
    statBlock: statBlock({
      creatureType: "undead", armorClass: 8, hitPointsAverage: 22, hitDiceFormula: "3d8 + 9",
      abilityScores: { str: 13, dex: 6, con: 16, int: 3, wis: 6, cha: 5 },
      challengeRating: "1/4", xp: 50, proficiencyBonus: 2,
      speed: "20 ft.", languages: "—",
      damageImmunities: "poison", conditionImmunities: "poisoned",
      traits: [{ name: "Undead Fortitude", description: "If damage reduces it to 0 hit points, it makes a Constitution save DC 5 + the damage taken; on a success it drops to 1 hit point instead." }],
      actions: [{ name: "Slam", description: "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d6 + 1) bludgeoning damage." }],
    }),
    backstory: backstory("Drowned in the flooding, and did not stay down"),
  },
];

// ---------------------------------------------------------------------------
// The battle maps
// ---------------------------------------------------------------------------

type Tile = PlacedTile;

function rect(tileId: string, x0: number, y0: number, x1: number, y1: number, extra: Partial<Tile> = {}): Tile[] {
  const out: Tile[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push({ tileId, x, y, ...extra });
  return out;
}

function at(tileId: string, cells: [number, number][], extra: Partial<Tile> = {}): Tile[] {
  return cells.map(([x, y]) => ({ tileId, x, y, ...extra }));
}

const MAP_W = 24;
const MAP_H = 16;

// "The Drowned Bell" — the finished map combat is shot on. Built to put the
// map's own features on screen at once: a chasm the bridge spans rather than
// replaces, a raised dais carrying real elevation, doors the DM can open, and
// enough tall geometry for the shading pass and the fog-of-war raycast to
// have something to say.
function drownedBellTiles(): Tile[] {
  return [
    ...rect("stone-floor", 1, 1, MAP_W - 2, MAP_H - 2),

    // Perimeter.
    ...rect("stone-wall", 0, 0, MAP_W - 1, 0),
    ...rect("stone-wall", 0, MAP_H - 1, MAP_W - 1, MAP_H - 1),
    ...rect("stone-wall", 0, 1, 0, MAP_H - 2),
    ...rect("stone-wall", MAP_W - 1, 1, MAP_W - 1, MAP_H - 2),

    // The chasm splitting the hall, and the bridge laid across it. The
    // bridge is a span: the chasm keeps existing underneath and either side
    // of the deck, which is the whole point of the layer.
    ...rect("chasm", 11, 2, 12, MAP_H - 3, { elevation: -30 }),
    ...at("bridge", [[11, 7], [12, 7], [11, 8], [12, 8]], { layer: "span" }),

    // Antechamber, west: a flooded corner and the way in.
    ...rect("water", 2, 11, 5, MAP_H - 3),
    ...at("wooden-door", [[0, 8]]),
    ...at("pillar", [[4, 3], [4, 12], [8, 3], [8, 12]]),
    ...at("torch-sconce", [[1, 4], [1, 11]]),
    ...at("rubble", [[6, 6], [7, 6], [6, 7], [5, 9], [9, 10]]),

    // Sanctum, east: the dais the bell hung over.
    ...rect("stone-floor", 16, 5, 21, 10, { elevation: 5 }),
    ...at("altar", [[18, 7], [19, 7]], { elevation: 5 }),
    ...at("stairs-up", [[15, 7], [15, 8]]),
    ...at("bookshelf", [[22, 3], [22, 4], [22, 11], [22, 12]]),
    ...at("torch-sconce", [[22, 7], [22, 8]]),

    // A fence penning off the north-east corner, run vertically — the case
    // tile rotation was added for.
    ...at("wooden-fence", [[20, 2], [20, 3]], { rotation: 90 }),

    // Decor. Purely cosmetic layer; never consulted by movement or sight.
    ...at("moss", [[3, 2], [7, 13], [14, 4]], { layer: "decor" }),
    ...at("bones", [[9, 5], [17, 12], [6, 10]], { layer: "decor" }),
    ...at("bloodstain", [[14, 9], [15, 10]], { layer: "decor" }),
    ...at("cracked-tile", [[13, 3], [14, 12], [10, 4]], { layer: "decor" }),
    ...at("banner", [[22, 6]], { layer: "decor" }),

    // DM-only markers. The server strips these before the map ever reaches a
    // player's browser, so they can sit here safely while the table view is
    // recording alongside the DM's.
    ...at("secret-door", [[MAP_W - 1, 13]], { layer: "gmOnly", note: "Behind the east shelves — comes out in the crypt stair." }),
    ...at("hidden-trap", [[15, 7]], { layer: "gmOnly", note: "Pressure plate on the lower stair. Dart, DC 13." }),
  ];
}

// "Chasm Crossing" — deliberately unfinished. The builder segment paints the
// chasm, spans it, rotates a fence and stamps an elevation on camera, so the
// footage is 25 seconds of the interesting decisions rather than three
// minutes of blocking out a room.
function chasmCrossingTiles(): Tile[] {
  return [
    ...rect("grass", 1, 1, 18, 12),
    ...rect("stone-wall", 0, 0, 19, 0),
    ...rect("stone-wall", 0, 13, 19, 13),
    ...rect("stone-wall", 0, 1, 0, 12),
    ...rect("stone-wall", 19, 1, 19, 12),
    ...at("tree", [[3, 3], [2, 8], [16, 4], [17, 9]]),
    ...at("boulder", [[6, 11], [13, 2]]),
    ...at("dense-brush", [[4, 5], [15, 7]]),
    ...at("wildflowers", [[5, 2], [11, 11]], { layer: "decor" }),
    ...at("game-trail", [[9, 12], [9, 11], [9, 10]], { layer: "decor" }),
  ];
}

// ---------------------------------------------------------------------------
// The seed itself
// ---------------------------------------------------------------------------

type Req = APIRequestContext;

async function post<T>(request: Req, path: string, data: unknown): Promise<T> {
  const res = await request.post(`/api${path}`, { data });
  if (!res.ok()) throw new Error(`POST ${path} -> ${res.status()} ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function patch<T>(request: Req, path: string, data: unknown): Promise<T> {
  const res = await request.patch(`/api${path}`, { data });
  if (!res.ok()) throw new Error(`PATCH ${path} -> ${res.status()} ${await res.text()}`);
  return res.json() as Promise<T>;
}

// Extras are the set dressing: they make a screen look lived-in but no
// segment fails without them. A schema drift here should show up as a loud
// line in the seed's summary, not as a seed that refuses to run.
const skipped: string[] = [];
async function optional(label: string, fn: () => Promise<unknown>) {
  try { await fn(); } catch (err) { skipped.push(`${label}: ${(err as Error).message.slice(0, 160)}`); }
}

async function signUpOrLogIn(request: Req, username: string, displayName: string) {
  const signup = await request.post("/api/auth/signup", { data: { username, password: PASSWORD } });
  if (!signup.ok() && signup.status() !== 409) {
    throw new Error(`signup ${username} -> ${signup.status()} ${await signup.text()}`);
  }
  if (signup.status() === 409) {
    const login = await request.post("/api/auth/login", { data: { username, password: PASSWORD } });
    if (!login.ok()) throw new Error(`login ${username} -> ${login.status()} ${await login.text()}`);
  }
  await optional("displayName", () => patch(request, "/auth/me", { displayName }));
}

// The localStorage every segment opens with. Two of these are first-run
// panels ("Welcome to Spark", the getting-started checklist) that are
// correct behaviour for a new account and pure noise over a seeded campaign
// — left on, they push the controls a shot is about to use off the bottom of
// the frame. The rest just guarantee a segment opens on the same screen
// whatever the previous take left selected.
export function demoStorage(demo: DemoWorld, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    "spark-active-world-id": demo.worldId,
    "spark-welcome-dismissed": true,
    [`spark-getting-started-dismissed-${demo.worldId}`]: true,
    ...extra,
  };
}

export function loadDemoWorld(): DemoWorld {
  if (!existsSync(DEMO_STATE_PATH)) {
    throw new Error(
      `No seeded demo world at ${DEMO_STATE_PATH}.\n` +
      `Run the seed project first:  npx playwright test --config=playwright.demo.config.ts --project=seed`,
    );
  }
  return JSON.parse(readFileSync(DEMO_STATE_PATH, "utf8")) as DemoWorld;
}

export function saveDemoWorld(state: DemoWorld) {
  mkdirSync(dirname(DEMO_STATE_PATH), { recursive: true });
  writeFileSync(DEMO_STATE_PATH, JSON.stringify(state, null, 2));
}

// True when the recorded world still resolves for the recorded DM account —
// i.e. the seed can be skipped and segments re-shot against it. A stale
// e2e.db (wiped, or migrated away) fails this and triggers a fresh seed.
export async function demoWorldIsLive(request: Req): Promise<DemoWorld | null> {
  if (!existsSync(DEMO_STATE_PATH)) return null;
  const state = loadDemoWorld();
  const login = await request.post("/api/auth/login", { data: { username: state.dm.username, password: PASSWORD } });
  if (!login.ok()) return null;
  const world = await request.get(`/api/worlds/${state.worldId}`);
  if (!world.ok()) return null;
  const map = await request.get(`/api/battle-maps/${state.battleMapId}`);
  return map.ok() ? state : null;
}

export async function seedDemoWorld(request: Req, playerRequest: Req): Promise<DemoWorld> {
  skipped.length = 0;
  const run = Date.now().toString(36);
  const dm = { username: `spark_dm_${run}`, displayName: "Evie" };
  const player = { username: `spark_player_${run}`, displayName: "Rowan" };

  await signUpOrLogIn(request, dm.username, dm.displayName);
  await signUpOrLogIn(playerRequest, player.username, player.displayName);

  const world = await post<{ id: string; name: string }>(request, "/worlds", {
    name: "Thornhallow",
    description: "A flooded river country under a broken abbey. The bell that drowned with it still rings on some nights, and the people who go looking for it do not come back the same.",
  });
  const worldId = world.id;

  // Let the player account in, so the companion view has a real membership
  // rather than the DM watching their own screen twice.
  const { code } = await post<{ code: string }>(request, `/worlds/${worldId}/join-code`, { role: "player" });
  await post(playerRequest, "/worlds/join", { code });

  // --- The party ---
  const playerCharacterIds: Record<string, string> = {};
  for (const pc of PARTY) {
    const { preparedSpells, ...input } = pc;
    const created = await post<{ id: string }>(request, "/player-characters", { ...input, worldId });
    playerCharacterIds[pc.name] = created.id;
    if (preparedSpells.length > 0) {
      await patch(request, `/player-characters/${created.id}`, { preparedSpells });
    }
  }

  // --- The opposition ---
  const monsterIds: Record<string, string> = {};
  for (const m of MONSTERS) {
    const created = await post<{ id: string }>(request, "/characters", { kind: "monster", worldId, ...m });
    monsterIds[m.name] = created.id;
  }

  // --- The maps ---
  const battleMap = await post<{ id: string }>(request, "/battle-maps", {
    name: "The Drowned Bell", width: MAP_W, height: MAP_H, tiles: drownedBellTiles(), worldId,
  });
  const draftMap = await post<{ id: string }>(request, "/battle-maps", {
    name: "Chasm Crossing", width: 20, height: 14, tiles: chasmCrossingTiles(), worldId,
  });

  // --- Set dressing: the screens a tour pans across should not be empty ---
  await optional("npcs", async () => {
    await post(request, "/characters", {
      kind: "npc", worldId, name: "Halder Vosk", race: "Human", alignment: "neutral good",
      templateId: "commoner", templateName: "Commoner",
      statBlock: statBlock({ creatureType: "humanoid", alignment: "neutral good", armorClass: 10, hitPointsAverage: 9, hitDiceFormula: "2d8", challengeRating: "0", xp: 10, languages: "Common" }),
      backstory: {
        occupationOrRole: "Ferryman on the Thorn",
        personalityTrait: "Counts the crossings out loud, every time.",
        ideal: "Everyone gets to the far bank.",
        bond: "His brother went into the abbey and came back wrong.",
        flaw: "Will not go near the water after dark.",
      },
    });
  });

  await optional("location", () => post(request, "/locations", {
    worldId, name: "The Sunken Abbey", locationType: "Ruin", category: "dungeon",
    description: "Three storeys of it stand above the floodline; the rest is guesswork and black water.",
    notableFeature: "The bell tower leans hard enough that the bell rests against the wall.",
    keeper: "Nobody living.",
    rumor: "It rings when someone in Thornhallow is about to die.",
  }));

  await optional("quest", () => post(request, "/quests", {
    worldId, title: "The Bell That Rang Itself", questType: "Investigation", tier: "Heroic",
    hook: "Three ferrymen have drowned on still water in a fortnight, each within an hour of the bell sounding.",
    objective: "Reach the abbey's bell chamber and find out what is ringing it.",
    complication: "The cult that keeps the bell got there first, and they want it rung.",
    reward: "The abbey's reliquary, and Thornhallow's gratitude — which is worth less than the reliquary.",
  }));

  await optional("faction", () => post(request, "/factions", {
    worldId, name: "The Vigil of the Ninth Toll", factionType: "Cult",
    agenda: "Wake what the abbey drowned to keep asleep.",
    methods: "Patience, drownings, and a great deal of rope.",
    publicFace: "A charitable order that maintains the river crossings.",
    hook: "They have been buying up every boat in Thornhallow for a year.",
  }));

  await optional("shop", () => post(request, "/shops", {
    worldId, name: "Vosk & Daughter, Chandlers",
    description: "Rope, lamp oil, tallow, and the only dry powder within thirty miles.",
    stock: [
      { id: "s1", itemId: "rope-hempen", itemName: "Hempen Rope (50 ft.)", price: 1, quantity: 8 },
      { id: "s2", itemId: "oil-flask", itemName: "Lamp Oil (flask)", price: 1, quantity: 24 },
      { id: "s3", itemId: "lantern-hooded", itemName: "Lantern, Hooded", price: 5, quantity: 3 },
      { id: "s4", itemId: "holy-water", itemName: "Holy Water (flask)", price: 25, quantity: 1 },
      { id: "s5", itemId: "crowbar", itemName: "Crowbar", price: 2, quantity: 4 },
    ],
  }));

  await optional("ledger", async () => {
    for (const entry of [
      { kind: "gold", label: "Sold the abbey candlesticks", amount: 180 },
      { kind: "gold", label: "Ferry passage, four of us, both ways", amount: -8 },
      { kind: "gold", label: "Halder's silence", amount: -25 },
      { kind: "item", label: "Reliquary key, cold to the touch", amount: 1 },
    ]) {
      await post(request, "/ledger", { worldId, authorName: dm.displayName, ...entry });
    }
  });

  await optional("session note", () => post(request, "/session-notes", {
    worldId, title: "The Ferryman's Brother", sessionLabel: "Session 6",
    summary: "The party paid Halder to take them upriver at night. He would not go past the second bend, so they rowed the rest themselves.\n\nThe bell rang twice while they were on the water. Maerwyn counted nine tolls the second time and nobody else heard more than two.\n\nEnded on the abbey steps, torches lit, door already open.",
    looseThreads: "Nobody has asked Halder what happened to his brother.\nThe reliquary key was already in Sable's pocket and she will not say since when.",
    nextSteps: "Up the bell stair. Ilesha wants the abbey consecrated before anyone touches the bell.",
  }));

  const state: DemoWorld = {
    seededAt: new Date().toISOString(),
    password: PASSWORD,
    dm, player, worldId, worldName: world.name,
    battleMapId: battleMap.id,
    draftBattleMapId: draftMap.id,
    playerCharacterIds, monsterIds,
  };
  saveDemoWorld(state);

  if (skipped.length > 0) {
    console.warn(`\n  Seeded, but ${skipped.length} optional item(s) did not save:`);
    for (const s of skipped) console.warn(`    - ${s}`);
    console.warn("");
  }
  return state;
}

export { PASSWORD as DEMO_PASSWORD, PARTY as DEMO_PARTY, MONSTERS as DEMO_MONSTERS, MAP_W, MAP_H };

// ---------------------------------------------------------------------------
// The live encounter
// ---------------------------------------------------------------------------

// Puts the world's shared encounter into a fight already in progress, so the
// combat segment opens on a table mid-session rather than on twenty seconds
// of somebody adding combatants one at a time.
//
// Composed for what the two recorded views are meant to prove, not for
// balance: the party stands west of the chasm with a torch between them, the
// opposition is east of it, and one of them is `hidden`. The DM's screen
// shows all of it; the cast-to-table screen drops the hidden one, replaces
// monster hit points with a status badge, and fogs every cell the party
// cannot currently see (filterEncounterForDisplay in the client, mirroring
// the non-owner branch of toEncounterDTO on the server). Walking a token
// east across the bridge is then a real reveal on the second screen.
// Stable ids for the armed encounter's combatants. Exported because the
// combat segment picks targets out of <select>s by value, not by label — an
// option reads "Grix (AC 17)" and "Magic Missile (Lvl 1)", and matching on
// that is matching on presentation.
export function demoCombatantId(kind: "pc" | "foe", name: string) {
  return `demo-${kind}-${name.toLowerCase().replace(/\W+/g, "-")}`;
}

export async function armEncounter(request: Req, demo: DemoWorld) {
  const pc = (name: string, gridX: number, gridY: number, over: Record<string, unknown> = {}) => ({
    id: demoCombatantId("pc", name),
    name,
    kind: "playerCharacter",
    playerCharacterId: demo.playerCharacterIds[name],
    initiative: 0, conditions: [], notes: "", hpVisible: true,
    gridX, gridY, sizeCategory: "medium",
    speedFeet: 30, visionRadiusFeet: 40,
    ...over,
  });

  const foe = (name: string, gridX: number, gridY: number, over: Record<string, unknown> = {}) => ({
    id: demoCombatantId("foe", name),
    name,
    kind: "monster",
    initiative: 0, conditions: [], notes: "", hpVisible: false,
    gridX, gridY, sizeCategory: "medium", speedFeet: 30,
    ...over,
  });

  const encounter = {
    round: 3,
    turnIndex: 0,
    zones: [],
    zoneEffects: [],
    activeBattleMapId: demo.battleMapId,
    // Deliberately empty: fog memory starts blank so the party's light is
    // the only thing on the table screen at the top of the segment.
    exploredCells: [],
    openDoorCells: [],
    combatants: [
      pc("Brannoc Duskbarrow", 3, 7, {
        initiative: 19, maxHp: 47, currentHp: 41, armorClass: 18,
        speedFeet: 25, lightRadiusFeet: 20,
      }),
      pc("Sable Wren", 5, 7, { initiative: 22, maxHp: 38, currentHp: 38, armorClass: 15 }),
      pc("Maerwyn Ashgrove", 3, 9, {
        initiative: 14, maxHp: 32, currentHp: 27, armorClass: 12,
        preparedSpells: ["fire-bolt", "magic-missile", "hold-person", "fireball"],
        spellSaveDc: 15, spellAttackBonus: 7,
      }),
      pc("Ilesha Fenn", 2, 8, {
        initiative: 11, maxHp: 41, currentHp: 41, armorClass: 18,
        preparedSpells: ["sacred-flame", "cure-wounds", "healing-word"],
        spellSaveDc: 15, spellAttackBonus: 7,
      }),
      foe("Grix", 14, 9, { initiative: 17, maxHp: 21, currentHp: 21, armorClass: 17 }),
      foe("Vessa Coldmourn", 17, 6, { initiative: 8, maxHp: 44, currentHp: 44, armorClass: 13 }),
      // Not on the table screen at all — this is the marker the DM can see
      // and the party cannot.
      foe("Drowned Acolyte", 20, 10, { initiative: 5, maxHp: 22, currentHp: 22, armorClass: 8, hidden: true }),
    ],
  };

  const res = await request.put(`/api/encounters/${demo.worldId}`, { data: encounter });
  if (!res.ok()) throw new Error(`arming the encounter failed: ${res.status()} ${await res.text()}`);
  return res.json();
}

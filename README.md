# Spark

A lean, robust prep-and-run companion for tabletop RPGs (starting with D&D 5e). Built for
Dungeon Masters who need a memorable NPC, monster, or plot hook *right now*, at the table —
a growing repository of everything worth reusing as a campaign world takes shape — and, once
your table is ready, a shared space your players can join for live session notes, dice, and
combat.

## What it does

Generation is meant to spark ideas, not cage them: once something's saved, every field is
yours to rewrite from the Roster (down to individual stat block traits and actions), and for
Items, Locations, Quests, Factions, and Encounter Tables you can skip generation entirely and
write one from a blank page with **Create Your Own**. NPCs/monsters lean on templates instead
of a from-scratch stat-block builder — generate close to what you want, then hand-edit it.

The **Create** tab generates six kinds of content, each with its own "surprise me completely"
fully-random mode:

- **NPCs & Monsters** — from a curated SRD-based dataset (races, backgrounds, alignments,
  ~16 NPC role stat blocks, and ~17 monster stat blocks spanning CR 1/8–8), each with a full
  backstory (personality, ideal, bond, flaw, appearance, mannerism, motivation, secret for
  NPCs; a leaner in-character set for monsters).
- **Items** — flavorful weapons, wearables, trinkets, and curios with a physical description,
  a minor quirk or property, and a lore hook. Deliberately non-mechanical/non-game-breaking:
  these are about flavor and story hooks, not stat bonuses.
- **Locations** — taverns, ruins, wilderness sites, and landmarks with a notable feature, who
  (or what) is keeping the place, and a rumor tying it into your world.
- **Quests** — ready-to-use adventure seeds with a hook, an objective, a complication, and a
  reward, tagged by type and rough tier.
- **Factions** — organizations with an agenda, methods, a public face, and a hook tying them
  into the wider world (rivals, secrets, debts).
- **Encounter Tables** — an 8-entry, roll-on-the-road table for a terrain (forest, mountain,
  urban, dungeon, coastal, swamp), sampled from a larger pool so tables vary each time.

The **Notes** tab is for your own session recaps — title, summary, loose threads, and next
steps — since that's content only you can write, not generate. A **Timeline** view lays every
note out in session order so you can skim how the campaign got here, and DM-only planning
fields can be marked hidden so a **player-facing recap** (shared through a world) shows what
happened without spoiling what you have planned next.

Everything above can be **saved to your Roster**, tagged and annotated, and organized into
**Worlds** (campaign containers) as your setting grows into a larger project. The Roster page
lets you browse, search, and filter anything you've saved (by world, by type, or by name/tag)
and fully edit it — not just tags/notes, the actual content.

**Worlds are shareable.** A world's owner can generate an invite code and hand it to their
players; anyone who joins becomes a party member with read access to that world's public
content (and, for planning content the DM marks hidden, none at all) plus write access to the
collaborative tools below. Players get their own **My Character** page to maintain a character
sheet inside a shared world, visible to the DM and — if they choose — the rest of the party.

The **Combat** tab is the at-the-table toolkit, and its two panes work together in real time
once a world is selected:

- **Dice Roller** — quick d4–d20 buttons plus a custom-expression roller (`2d6+3`), with a
  personal roll history and, in Party mode, a shared **party roll log** everyone in the world
  can see and post to. Any roll can be **applied straight to combat** — pick a combatant and
  a Damage/Heal direction and the total lands on their HP without retyping it.
- **Initiative Tracker** — build an encounter (monsters, player characters, or custom
  combatants), track initiative order, HP, AC, and conditions (with a built-in **condition
  rules reference** for quick lookups at the table), and step through rounds/turns. In Party
  mode this becomes **Live Session Mode**: the DM's encounter state syncs to every party
  member in real time, with per-combatant control over whether HP numbers are shown exactly
  or only as a status band (healthy/injured/bloodied/near death/down) — useful for keeping
  monster HP a little mysterious without hiding whether the fight is going well. A one-click
  **Rest** (short or long) resets HP and clears conditions between fights.

Small **activity badges** on the Notes and Combat tabs let players know something happened —
a new roll, a note, or a live encounter update — without having to keep a tab open and watch.

A **global search bar** in the header searches across every saved entry (name, description,
tags, notes) and jumps straight to it in the Roster. From any Roster entry you can **link it
to any other entry** — an NPC works for a Faction, is found at a Location, gives a Quest,
carries an Item — with an optional freeform relationship label, so the repository becomes an
actual web of connections instead of a pile of disconnected content. Links are bidirectional
(visible from both linked entries) and clean themselves up automatically when either side is
deleted.

## Stack

- **Client**: React + TypeScript + Vite
- **Server**: Express + TypeScript (run directly via [`tsx`](https://github.com/privatenumber/tsx), no build step)
- **Database**: SQLite via Prisma
- **Shared**: a `shared` workspace package with the SRD dataset, TypeScript types, and the
  generation engines, consumed directly by both client and server (no separate build step)

This is an npm-workspaces monorepo: `shared/`, `server/`, `client/`.

## Getting started

```bash
npm install

# one-time: create the SQLite database
cp server/.env.example server/.env
npm run --workspace server prisma:migrate

# run both in separate terminals
npm run dev:server   # http://localhost:4000
npm run dev:client   # http://localhost:5173 (proxies /api to the server)
```

Open http://localhost:5173.

## Production build

```bash
npm run build          # builds the client to client/dist
npm run start:server   # runs the API with tsx
```

In production the Express server serves the built `client/dist` itself (with an SPA
fallback for client-side routes) alongside `/api/*`, so a single running process is
enough — no separate static host or reverse proxy required.

## Deploying to Render

`render.yaml` at the repo root is a [Render Blueprint](https://render.com/docs/blueprint-spec)
that provisions this as one paid **Starter** web service with a 1GB persistent disk
(mounted at `/var/data`) holding the SQLite database, so everything you save survives
restarts and redeploys.

1. Push this repo to GitHub (already done if you're reading this from the PR).
2. In the Render dashboard: **New > Blueprint**, connect this repo, and Render will
   read `render.yaml` and propose the `spark` service + disk.
3. Click **Apply** (you'll need a payment method on file — this uses a paid plan, not
   the free tier, specifically so the SQLite disk persists).
4. On first deploy, the start command runs `prisma migrate deploy` before starting the
   server, so the database schema is created automatically on the disk.

Want a free-tier deploy instead? Change `plan: starter` to `plan: free` and delete the
`disk` block in `render.yaml` — but note the SQLite file will then reset on every
redeploy and periodically on restart, so treat Roster/Worlds as non-persistent in that
configuration.

## Project layout

```
shared/       SRD dataset, types, and the generation engines (characters, items,
              locations, quests, factions, encounter tables)
server/       Express API + Prisma/SQLite persistence: entity CRUD, cross-entity
              search & links, world sharing, session notes, player characters,
              party roll log, live encounters, and activity aggregation
client/       React SPA — Create (NPCs/Monsters, Items, Locations, Quests, Factions,
              Encounter Tables), Notes (+ Timeline), Roster, My Character, Worlds
              (sharing/invites), Combat (Dice Roller + Initiative Tracker / Live
              Session Mode), global search
render.yaml   Render Blueprint for a one-click paid deploy with a persistent disk
```

## Data & licensing note

Stat blocks are derived from the D&D 5e System Reference Document (SRD), which is
available for reuse. All other flavor text (names, personality/backstory tables, monster
epithets, item/location/quest/faction/encounter flavor content) is original content
written for this project.

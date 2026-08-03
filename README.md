# Spark

A lean, robust prep-and-run companion for tabletop RPGs (starting with D&D 5e). Built for
Dungeon Masters who need a memorable NPC, monster, or plot hook *right now*, at the table —
and a growing repository of everything worth reusing as a campaign world takes shape.

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
steps — since that's content only you can write, not generate.

Everything above can be **saved to your Roster**, tagged and annotated, and organized into
**Worlds** (campaign containers) as your setting grows into a larger project. The Roster page
lets you browse and fully edit anything you've saved (not just tags/notes — the actual
content), filtered by world or by type.

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
server/       Express API + Prisma/SQLite persistence, plus cross-entity search & links
client/       React SPA — Create (NPCs/Monsters, Items, Locations, Quests, Factions,
              Encounter Tables), Notes, Roster, Worlds, global search
render.yaml   Render Blueprint for a one-click paid deploy with a persistent disk
```

## Data & licensing note

Stat blocks are derived from the D&D 5e System Reference Document (SRD), which is
available for reuse. All other flavor text (names, personality/backstory tables, monster
epithets, item/location/quest/faction/encounter flavor content) is original content
written for this project.

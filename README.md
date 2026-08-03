# Spark

A lean, robust NPC & monster generator for tabletop RPGs (starting with D&D 5e). Built for
Dungeons Masters who need a memorable stat block and backstory *right now*, at the table —
and a place to keep the ones worth reusing as a campaign world grows.

## What it does

- **Generate NPCs or monsters** from a curated SRD-based dataset (races, backgrounds,
  alignments, ~16 NPC role stat blocks, and ~17 monster stat blocks spanning CR 1/8–8).
- **Steer as much or as little as you want** — pick a race, role, challenge rating,
  background, and alignment, or leave any field on "Random." A "Surprise me completely"
  toggle randomizes everything, including whether you get an NPC or a monster.
- **Every generated creature gets a backstory**: personality trait, ideal, bond, flaw,
  appearance, mannerism, motivation, and secret (monsters get a leaner, in-character set:
  role, distinguishing feature, and motivation).
- **Save characters to your roster**, tag and annotate them, and organize them into
  **Worlds** (campaign containers) as your setting grows into a larger project.

## Stack

- **Client**: React + TypeScript + Vite
- **Server**: Express + TypeScript (run directly via [`tsx`](https://github.com/privatenumber/tsx), no build step)
- **Database**: SQLite via Prisma
- **Shared**: a `shared` workspace package with the SRD dataset, TypeScript types, and the
  generation engine, consumed directly by both client and server (no separate build step)

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

Serve `client/dist` with any static file server, pointed at an API host that has
`/api/*` reachable (or reverse-proxy `/api` to the server process).

## Project layout

```
shared/   SRD dataset, types, and the character/monster generation engine
server/   Express API + Prisma/SQLite persistence (worlds, characters)
client/   React SPA (Generator, Roster, Worlds)
```

## Data & licensing note

Stat blocks are derived from the D&D 5e System Reference Document (SRD), which is
available for reuse. Flavor text (names, personality/backstory tables, monster
epithets) is original content written for this project.

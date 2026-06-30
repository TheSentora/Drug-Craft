# 🌿 DrugCraft

A Hay Day–style farming game. Plant, grow and sell your crops to build a farming empire — tobacco, khat, cannabis, shrooms, coca and poppy.

Single-player, no backend. Progress is saved automatically to your browser (`localStorage`), and crops keep growing in real time even while the tab is closed.

## How to play

- **Plant** — pick a seed in the side panel, then tap an empty plot.
- **Grow** — each crop ripens over real time (a countdown shows on the plot).
- **Harvest** — tap a ripe plot (or hit *Harvest all*) to add the crop to your stash.
- **Sell** — sell from the Market panel for cash.
- **Expand** — tap a locked plot to clear new land (price rises each time).
- **Level up** — harvesting earns XP; new crops unlock as you level up.

## Tech

- Next.js 16 (App Router) + React 19
- TypeScript, Tailwind CSS v4
- HTML5 Canvas render loop for the farm board

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

## Project layout

```
app/
  game/
    types.ts      shared types
    crops.ts      crop catalog (cost, grow time, price, unlock level)
    levels.ts     XP ⇄ level curve
    store.ts      game state, actions, localStorage persistence
    renderer.ts   canvas board renderer + click hit-testing
  components/
    Game.tsx      React HUD (top bar, seeds, market) + canvas mount
  page.tsx        mounts the game
  layout.tsx      root layout + metadata
```

### Art note

Crops and tiles currently render with **emoji + simple canvas shapes** as
placeholders. To use real artwork, drop PNGs in `public/` and swap the
`fillText(emoji, …)` calls in `renderer.ts` for `drawImage(...)`.

# 🌿 DrugCraft

A Hay Day–style farming game. Plant, grow and sell your crops to build a farming empire — tobacco, khat, cannabis, shrooms, coca and poppy.

Single-player, no backend. Progress is saved automatically to your browser (`localStorage`), and crops keep growing in real time even while the tab is closed.

The farm is a pannable **isometric island** — a 5×5 expandable field surrounded
by grass, a pond, a farmhouse, a barn and trees.

## How to play

- **Move around** — drag to pan the world, scroll to zoom, ⌂ to recenter.
- **Plant** — pick a seed in the side panel, then tap an empty soil plot.
- **Grow** — each crop ripens over real time (a countdown shows on the plot).
- **Harvest** — tap a ripe plot (or hit *Harvest all*) to add the crop to your stash.
- **Sell** — sell from the Market panel for cash.
- **Expand** — tap a locked plot to clear new land (price rises each time).
- **Level up** — harvesting earns XP; new crops unlock as you level up.

## Tech

- Next.js 16 (App Router) + React 19
- TypeScript, Tailwind CSS v4
- HTML5 Canvas isometric renderer (camera pan/zoom, depth-sorted draw)

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
    world.ts      isometric projection + island layout (field, pond, decor)
    store.ts      game state, actions, localStorage persistence
    sprites.ts    per-crop SVG icon lookup
    renderer.ts   isometric world renderer (camera, depth sort, hit-testing)
  components/
    Game.tsx      React HUD (top bar, seeds, market) + canvas mount
  page.tsx        mounts the game
  layout.tsx      root layout + metadata
```

### Art

Each crop has a hand-made vector icon at `public/sprites/<crop>.svg`, drawn on
the board and in the HUD (emoji fallback if a file is missing). Tiles, buildings
and trees are drawn procedurally by the canvas renderer.

# 🌿 DrugCraft

A Hay Day–style farming game. Plant, grow and sell your crops to build a farming empire — tobacco, khat, cannabis, shrooms, coca and poppy.

Single-player, no backend. Progress is saved automatically to your browser (`localStorage`), and crops keep growing in real time even while the tab is closed.

The farm is a pannable **isometric island in the sea** — a fenced, expandable
5×5 field with a farmhouse, barn, windmill, pond, dirt path, trees, flowers,
wandering chickens and butterflies. Textured tiles, soft shadows, animated
water, drifting cloud shadows and particle effects bring it to life.

## How to play

- **Move around** — drag to pan the world, scroll to zoom, ⌂ to recenter.
- **Plant** — pick a seed in the side panel, then tap an empty soil plot.
- **Grow** — each crop ripens over real time (a countdown shows on the plot).
- **Harvest** — tap a ripe plot (or hit *Harvest all*) to add the crop to your stash.
- **Sell** — sell from the Market panel for cash.
- **Orders** — deliver customer orders from the Orders board for bonus cash + XP
  (reroll ones you don't like).
- **Expand** — tap a locked plot to clear new land (price rises each time).
- **Level up** — harvesting and orders earn XP; new crops unlock as you level up.
- **Sound** — plant/harvest/sell/level-up feedback, mutable from the top bar.

## Tech

- Next.js 16 (App Router) + React 19
- TypeScript, Tailwind CSS v4
- HTML5 Canvas isometric renderer (camera pan/zoom, depth-sorted draw,
  baked texture tiles, particles, ambient animation)
- WebAudio synth for sound effects (no audio files)

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
    world.ts      isometric projection + island layout (field, pond, path, fences, decor)
    store.ts      game state, actions, orders, localStorage persistence
    sprites.ts    per-crop SVG icon lookup
    sfx.ts        WebAudio sound effects + mute preference
    renderer.ts   isometric world renderer (camera, depth sort, textures, fx)
  components/
    Game.tsx      React HUD (top bar, seeds, market) + canvas mount
  page.tsx        mounts the game
  layout.tsx      root layout + metadata
```

### Art

Each crop has a hand-made vector icon at `public/sprites/<crop>.svg`, drawn on
the board and in the HUD (emoji fallback if a file is missing). Tiles, buildings
and trees are drawn procedurally by the canvas renderer.

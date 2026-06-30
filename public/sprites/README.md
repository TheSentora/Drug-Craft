# Crop sprites (drop-in)

No art ships here by default — the board uses emoji until you add real plant art.

To give a crop a real sprite, drop a PNG named after the crop id:

    tobacco.png   khat.png   cannabis.png   shrooms.png   coca.png   poppy.png

Each PNG is either:
- a single square frame (shown at every growth stage), or
- a horizontal strip of N equal SQUARE frames = growth stages, left (just
  planted) -> right (ripe). e.g. a 5-stage 16px strip is 80x16.

Pixel art is drawn with nearest-neighbor (crisp). Missing files fall back to
the crop's emoji automatically — no code changes needed.

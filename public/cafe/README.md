# Cat Café

A small top-down café you can walk around, sit in, and buy coffee from. Vanilla
JavaScript, ES modules, Canvas 2D — no build step, no dependencies, no framework.

Everything ships with generated placeholder art. Real artwork replaces the PNGs
in `assets/` without touching a line of code.

---

## Run locally

The game is plain static files, but ES modules cannot load over `file://`, so it
needs a server. From the repository root:

```
npm run cafe
```

Leave it running and open **http://localhost:8000/cafe/**. That server has no
dependencies and needs no `npm install`. If port 8000 is busy, use
`PORT=8001 npm run cafe`.

The site's own dev server works too: `npm run dev`, then
http://localhost:3000/cafe.

Any static server will do — the folder assumes nothing about its host:

```
python3 -m http.server 8000    # from the public/ folder
npx serve public
```

## Controls

| | |
|---|---|
| `W A S D` or arrow keys | walk |
| `Enter` at a table | sit; again to work; again back to sitting |
| `Enter` at the counter | buy a coffee |
| any direction key while seated | stand up |
| `` ` `` (backtick) | the debug editor |

Your name, chosen cat and coffee count are kept in `localStorage`.

Below 700px wide the game shows a "desktop only for now" notice.

---

## Deploying

The whole folder is self-contained and every path inside it is relative, so it
works from any prefix.

**Into an existing site:** copy this folder to `public/cafe/`. On Vercel, Next
and most static hosts, `public/` is served from the site root, so the game lands
at `/cafe/`. Nothing else needs configuring.

One wrinkle with Next: it does not resolve a `public/` directory to its
`index.html`, so `/cafe` alone would 404. This repository redirects it in
`next.config.mjs`:

```js
async redirects() {
  return [{ source: '/cafe', destination: '/cafe/index.html', permanent: false }];
}
```

It has to be a *redirect*, not a rewrite — the game loads its modules and art by
relative path, so the browser's URL must actually sit inside `/cafe/`.

**Standalone:** serve this folder as the site root. It works unchanged.

---

## Swapping in real artwork

Replace files in `assets/`. Keep the names and the pixel dimensions and nothing
in the code changes.

| File | Size | What it is |
|---|---|---|
| `cat-01.png` … `cat-08.png` | 128 × 192 | one sprite sheet per playable cat |
| `room-bg.png` | 480 × 270 | the room, drawn behind every sprite |
| `room-fg.png` | 480 × 270 | the parts that draw in front of sprites; transparent elsewhere |

### Sprite sheet layout

Each sheet is **4 columns × 6 rows of 32 × 32 frames**, read left to right:

| Row | Animation | Frames |
|-----|-----------|--------|
| 0 | walk down | 4 (frame 0 doubles as idle) |
| 1 | walk up | 4 |
| 2 | walk left | 4 |
| 3 | walk right | 4 |
| 4 | sit | 4 — one per facing: down, up, left, right |
| 5 | work | 2-frame loop, facing down |

Walk animations play at 8fps and stop on frame 0 when idle. The row assignments,
frame counts and frame rates all live in `ANIMATIONS` in `src/config.js` — if
your sheet is laid out differently, change that table rather than any draw code.

A cat's feet sit at **(16, 28)** within its 32 × 32 frame (`PLAYER.anchor`), and
the collision box is 16 × 8 at that point. Draw your cat standing on that spot
or it will look like it's hovering.

### Background and foreground

Sprites are drawn between the two room layers, sorted by their y position. That
gives you one rule:

> Anything a character should be able to stand *behind* goes in `room-fg.png`.
> Everything else goes in `room-bg.png`.

In the placeholder art each table circle is split across both — the near half in
the background, the far half in the foreground — which is what makes a cat
standing at the back of a table appear behind it. The counter keeps its whole
front edge in the foreground, so anyone behind the counter is partly hidden by
it.

### Regenerating the placeholders

`tools/make-placeholders.html` redraws every asset at its exact size. Open it
directly from disk or serve it — served, it reads the real `data/room.json`, so
the furniture matches the room you actually have. Use the download buttons and
drop the PNGs into `assets/`.

---

## Editing the room

`data/room.json` holds three things: `solids` (collision rectangles), `zones`
(interaction areas — `table` zones carry a `seat` and a `facing`, `counter`
zones don't), and `spawn`.

Editing it by hand works, but the debug editor is faster. Press `` ` `` in game:

| | |
|---|---|
| `1` `2` `3` | place a solid / table zone / counter zone |
| drag empty floor | create a rect |
| drag a rect | move it |
| drag its corner handle | resize it |
| `Delete` | remove the selected rect |
| shift-click | set the selected table zone's seat |
| `[` `]` | cycle that seat's facing |
| **Copy JSON** | put the whole room on the clipboard |

Edits apply live, so you can walk into what you just drew. When it feels right,
Copy JSON and paste it over `data/room.json`.

Expect to nudge rects when you swap in real art: collision is rectangular while
furniture rarely is, and reconciling the two by eye is what this tool is for.

---

## How it fits together

```
index.html            canvas, title screen markup, styling
src/
  main.js             bootstrap, scaling, the players map, the tick
  loop.js             fixed-timestep loop (60Hz) with an fps counter
  input.js            held keys in a Set; edge-triggered keys separately
  player.js           Player factory, applyMovement, applyInteraction
  room.js             room.json loading, collision and zone queries
  render.js           background, y-sorted sprites, foreground
  sprites.js          sheet loading, animation frame selection
  ui.js               title screen and HUD
  debug.js            the editor overlay
  net.js              multiplayer stub
  config.js           every tunable in one place
data/room.json        collision rects, interaction zones, spawn
assets/               the art
tools/                the placeholder generator
```

**Rendering.** Everything is authored at 480 × 270 and scaled up by the largest
whole number that fits the window, centred, letterboxed. Fractional scaling
would blur the pixels, so it never happens.

**Simulation.** The loop runs a fixed 60 ticks per second regardless of frame
rate, and clamps how much time it will simulate at once so a backgrounded tab
doesn't stampede on return.

## Built to become multiplayer

Phase two adds real-time multiplayer. The shape is already in place:

- **Every player is an entry in one `Map`,** including the local one, which is
  just the entry keyed `local`. Nothing special-cases it except reading the
  keyboard and drawing the HUD. `stepPlayer` runs identically for everyone.
- **`Player` is plain serializable data** — `{ id, name, catId, x, y, dir,
  state, holdingCoffee, coffees }`. No methods, no DOM references, no canvas.
- **Room state and render state are separate objects.** Animation timers live in
  their own map and never travel over the wire.
- **Movement and interaction are pure functions.** `applyMovement(player, input,
  dt, collision)` and `applyInteraction(player, input, room)` take state and
  return state; they read no clock, no DOM, no module-level mutable anything. A
  server can run the same code on the same inputs and get the same answer.
- **`src/net.js` is a stub the loop already calls.** `sendInput` is invoked once
  per tick with the local input; `onSnapshot` is wired to a handler that upserts
  every player a snapshot names and drops the ones it doesn't. Filling in the
  transport is the work; restructuring the game is not.

The one piece deliberately left for phase two is reconciliation: right now a
snapshot would overwrite the local player's predicted position outright.

# The Café

A small top-down café you can walk around, sit in, and buy coffee from. Vanilla
JavaScript, ES modules, Canvas 2D — no build step, no dependencies, no framework.

The people are hand-drawn faces, one 32 × 32 PNG each, looking straight out at
you. They bob when they walk and sit still when they sit. That is the whole
visual system for a person: no sprite sheets, no frames, no directions.

---

## Run it

The game is plain static files, but ES modules cannot load over `file://`, so it
needs a server. From the repository root:

```
npm run cafe
```

Leave it running and open **http://localhost:8000/cafe/**. That server has no
dependencies and needs no `npm install`. If port 8000 is taken, use
`PORT=8001 npm run cafe`.

The site's own dev server works too: `npm run dev`, then
http://localhost:3000/cafe. Any static server will do — the folder assumes
nothing about its host.

## Controls

| | |
|---|---|
| `W A S D` or arrow keys | walk |
| `Enter` at a table or bar | sit at the nearest free seat |
| `Enter` at the counter | buy a coffee |
| `Enter` at the jukebox | stop the music, or start it again |
| any direction key while seated | stand up |
| `` ` `` (backtick) | the debug editor |

Your name, chosen face and coffee count are kept in `localStorage`. Below 700px
wide the game shows a "desktop only for now" notice.

---

## Deploying

The whole folder is self-contained and every path inside it is relative, so it
works from any prefix.

**Into an existing site:** copy this folder to `public/cafe/`. On Vercel, Next
and most static hosts, `public/` is served from the site root, so the game lands
at `/cafe/`.

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

## Swapping in artwork

Replace files in `assets/`. Keep the names and the pixel sizes and nothing in
the code changes.

| File | Size | What it is |
|---|---|---|
| `face-01.png` … `face-08.png` | 32 × 32 | one face per person, transparent, centred, looking at the viewer |
| `room-bg.png` | 640 × 360 | the room, drawn behind everyone |
| `room-fg.png` | 640 × 360 | the parts that draw in front of people; transparent elsewhere |

### Faces

One drawing each. No frames — the walk bob is code. Line weight of 2px or more:
a face is 32px in a 640px-wide room, about 5% of the width, and hairlines
disappear.

`tools/prep-faces.html` takes drawings at any size in any format the browser can
open, trims each to its content, scales it to fit with its aspect preserved,
centres it on a 32 × 32 transparent canvas and names it. It also shows each face
at 1×, 2× and 4×, and all of them together on the café floor — the honest test
is whether a face still reads at the size it will actually be.

The count lives in `FACE_COUNT` in `src/config.js`. Drawing a ninth face means
adding `face-09.png` and raising that number; nothing else changes.

### The two room layers

Sprites are drawn between the two, sorted by the ground point. That gives one
rule:

> Can a person stand **behind** this and be partly hidden by it? Foreground.
> Everything else goes in the background.

Nothing passes behind the bar rail, so it stays in the background. A tall object
spanning half the room cannot be sorted sensibly.

`tools/make-placeholders.html` regenerates the room art from `data/room.json`,
in the café's three colours — cream floor, charcoal structure, red for accents.
Furniture follows the data: each solid is drawn as whatever kind it says it is.

`ARTWORK.md` lists everything that needs drawing, at the size it ships at.

---

## Sound

The café hums, plays something on the jukebox, and lets the garden in through
the doorway. Walk between them and it crossfades, because the jukebox and the
garden are at opposite ends of a 640px room.

**Nothing makes a sound until you click.** Browsers refuse to start audio
outside a user gesture, so rather than starting one muted and hoping, there is
no AudioContext at all until the first click on the title screen.

Doors creak. Walking into the garden doorway swings it open and walking out
lets it fall shut, and arriving through the front door is three sounds rather
than one — the swing, the bell over it, then the door closing behind you.

The garden is only heard **through** that doorway. There is a solid wall between
the café and the birds, so in the café the doorway is a ceiling on how loud they
can get: they fade in over the last stretch of floor before the opening and are
gone by mid-room. Step through and you hear them directly instead. The two agree
at the threshold, so crossing it is a fade and not a jump.

**There is no mute button and no volume slider.** Your operating system has a
volume key and your browser can mute the tab, and both are better than anything
this café could draw in a corner.

### There are no audio files

Every sound is built out of oscillators and filtered noise at the moment it
plays — seven one-shots in `src/sounds.js`, three loops in `src/ambience.js`.
No download, no dependency, nothing to license. It is what
`tools/make-placeholders.html` does for the room art: something real to work
against, replaced by the real thing later.

To replace one with a recording:

1. Drop `assets/audio/<name>.mp3` in — `door`, `doorOpen`, `doorClose`,
   `step`, `sit`, `stand`, `coffee`, `click` or `pick`.
2. Add that name to the `files` list in `assets/audio/manifest.json`.

No code changes. The manifest exists so the café makes exactly one request at
startup instead of seven failing ones.

### Tuning it

Every number is in `AUDIO` in `src/config.js`: the mix, and the `near` and `far`
radii that decide how far the jukebox carries. `near` is where a loop is at full
volume, `far` where it reaches silence. The garden has a second pair under
`throughDoor` — the same two radii measured from the doorway, which is what
limits it inside the café.

`AUDIO.doors` lists the doorways that creak. They are written down rather than
read off `room.json` because the layout colour key has no colour for a door, so
the importer has nothing to emit for one.

Footsteps have no setting. One plays every time the walk bob completes a cycle,
so a footfall lands exactly when the face touches down — the sound of a step and
the sight of one are the same number, and cannot drift apart.

In the browser console, `cafe.ambience.levels()` reports what each loop is
currently sitting at, which is the only way to check positional audio without
ears.

---

## The room

`data/room.json` holds `solids` (collision rectangles, each with a `kind`),
`zones` (interaction areas — `table` and `bar` zones carry a list of `seats`)
and `spawn`.

**It is generated, not hand-written.** The source is a drawing:

1. `tools/layout-template.html` downloads a 640 × 360 Figma starter — an 8px
   grid, walls at true thickness, every element at true size, labelled bars for
   the distances that matter.
2. Draw the room over it as flat rectangles in the key colours (black wall, red
   small table, magenta big table, blue counter, cyan bar rail, yellow jukebox,
   green seat dot, orange spawn dot). Export a 640 × 360 PNG at 1×.
3. `tools/import-map.html` turns it into `room.json`, cutting connected shapes
   back into rectangles so an L-shaped counter keeps its empty corner, and
   warning about seats inside solids, an unreachable spawn, or gaps too narrow
   to walk through.
4. Paste the result over `data/room.json`.

`data/layout-map.png` is the drawing the current room came from. `LAYOUT.md` has
every dimension and the colour key.

**Seats are computed, not placed:** every side of a table with clear floor
beyond it gets one. Walkable and seatable are the same thing. To have no seat on
a side, put the table against a wall.

### The debug editor

Press `` ` `` in game for the overlay: solids in red, zones in blue, seats
marked.

| | |
|---|---|
| `1` `2` `3` `4` `5` | place a solid / table / counter / bar / jukebox |
| drag empty floor | create a rect |
| drag a rect | move it |
| drag its corner handle | resize it |
| `Delete` | remove the selected rect |
| shift-click | add a seat to the selected zone, or remove one you hit |
| `R` | reload the room art past the cache, without moving anyone |
| **Copy JSON** | put the whole room on the clipboard |

Edits apply live, so you can walk into what you just drew.

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
  render.js           background, people sorted by ground point, foreground
  faces.js            the eight faces, the shadow, the bob
  ui.js               title screen and HUD
  debug.js            the editor overlay
  net.js              multiplayer stub
  config.js           every tunable in one place
data/room.json        collision rects, zones with seats, spawn
data/layout-map.png   the drawing room.json was generated from
assets/               the art
tools/                layout template, layout importer, room art, face prep
```

**Rendering.** Everything is authored at 640 × 360 and scaled up by the largest
whole number that fits the window, centred, letterboxed. Fractional scaling
would blur, so it never happens.

**The ground point.** `player.x, player.y` is the spot on the floor, not the
centre of the face. Collision (a 16 × 8 box), depth sorting and seat snapping
all use it. The face is drawn centred `FACE.hover` (14px) above it, with a soft
shadow on the floor beneath.

**The bob.** Phase advances with distance walked, not with the clock, so it
cannot drift out of step with speed: 60px of floor gives the same phase whether
crossed at 30 or 120 pixels a second. One up-and-down every 18px, 2px at the
peak, fading in and out over 200ms so stopping settles instead of jolting.
Seated is perfectly still. Every number is in `FACE` in `config.js`.

**Simulation.** A fixed 60 ticks per second regardless of frame rate, clamped so
a backgrounded tab doesn't stampede on return.

## Built to become multiplayer

Phase two adds real-time multiplayer. The shape is already in place:

- **Every player is an entry in one `Map`,** including the local one, which is
  just the entry keyed `local`. Nothing special-cases it except reading the
  keyboard and drawing the HUD. `stepPlayer` runs identically for everyone.
- **`Player` is plain serializable data** — `{ id, name, faceId, x, y, state,
  holdingCoffee, coffees }`. No methods, no DOM references, no canvas.
- **Room state and render state are separate objects.** The bob's phase, its
  amplitude and the last known position live in a render-state map keyed by
  player id, created lazily, and never travel over the wire.
- **Movement and interaction are pure functions.** `applyMovement(player, input,
  dt, collision)` and `applyInteraction(player, input, room, taken)` take state
  and return state; they read no clock, no DOM, and nothing from the draw path.
- **Faces are indexed by `faceId`, never cached per player,** so someone
  changing face between snapshots just works.
- **The bob reads only position,** so a player driven by snapshots bobs exactly
  like one driven by this keyboard — including the bursty arrival of snapshot
  positions, which is why a player keeps counting as walking for a moment after
  their last movement.
- **`src/net.js` is a stub the loop already calls.** `sendInput` runs once per
  tick with the local input; `onSnapshot` upserts every player a snapshot names
  and drops the ones it doesn't.

The one piece deliberately left for phase two is reconciliation: a snapshot
currently overwrites the local player's predicted position outright.

**Companion docs:** `CONTEXT.md` (the whole project brief), `LAYOUT.md`
(dimensions and the colour key), `ARTWORK.md` (what needs drawing), `BACKLOG.md`
(everything not yet built).

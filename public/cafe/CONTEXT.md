# The Café — project context

Paste-into-a-Claude-Project brief. Everything a fresh session needs to be useful
without re-deriving decisions or re-litigating settled ones.

Last updated: 22 September 2026.

---

## 1. What this is

A small top-down 2D browser café. You pick a name and a face, walk around, sit
at tables or the outdoor bar, buy coffee. Later: other people, in real time.

It is a corner of a personal site, not a product. The feeling to protect is
"somebody else is here with me" — a room of little hand-drawn faces looking out
at you. Quiet, warm, low-stakes.

**Repo:** `sohathakar-sudo/Soha-website`
**Branch:** `claude/adoring-hypatia-1c8zo9`
**Lives in:** `public/cafe/` — a self-contained static folder
**Run it:** `npm run cafe` → http://localhost:8000/cafe/ (no install needed;
a dependency-free Node static server. `npm run dev` → :3000/cafe also works.)

---

## 2. Hard constraints

- **Vanilla JavaScript, ES modules, no build step.** No React, no bundler, no
  npm dependencies in the game itself.
- **Canvas 2D.** No WebGL, no game engine.
- **All asset paths relative** — never absolute, never a leading `/`. The folder
  must work dropped into any site and standalone.
- **Native resolution 640 × 360**, scaled up by the largest whole-number factor
  that fits, centred, letterboxed. Never fractional — it blurs.
- Desktop-first. Under 700px wide, show the "desktop only for now" notice.

---

## 3. Architecture, and the rules that keep it multiplayer-ready

Multiplayer isn't built. The shape is, and it must not be broken:

- **All players live in one `Map<string, Player>` called `players`.** The local
  player is an ordinary entry keyed `local`. Nothing may special-case it except
  reading the keyboard and drawing the HUD.
- **`Player` is plain serializable data:** `{ id, name, faceId, x, y, state,
  holdingCoffee, coffees, coffeeLeft, music }`. No methods, no DOM or canvas references. `faceId`
  is 1–8. `dir` is local-only and must never reach the draw path.
- **Room state and render state are different objects.** Positions and states in
  the player; bob phase and interpolation in a render-state map keyed by player
  id, created lazily so someone appearing mid-session gets one.
- **`applyMovement(player, input, dt, collision) -> {x, y}`,
  `applyInteraction(player, input, room, taken) -> {…}` and
  `applyTime(player, dt) -> {…}` are pure.** State in,
  state out. No clock, no DOM, no module-level mutable state, nothing from the
  draw path. A server must be able to run them.
- **`src/net.js` is a stub the loop already calls** — `connect`, `sendInput`
  (once per tick with local input), `onSnapshot` (upserts everyone a snapshot
  names, drops everyone it doesn't).
- **Never cache anything per player id.** Faces are loaded once and indexed by
  `faceId`. A player changing face between snapshots must just work.

**Simulation:** fixed 60 ticks/second with an accumulator, clamped so a
backgrounded tab doesn't stampede on return.

**Draw order:** `room-bg.png` → players sorted ascending by ground point `y`,
each as shadow-then-face → `room-fg.png` → HUD.

**The ground point:** `player.x, player.y` is the spot on the floor, not the
centre of the drawn face. Collision (a 16 × 8 box), y-sorting and seat snapping
all use it. The face is drawn centred 14px above it.

---

## 4. File map

```
public/cafe/
  index.html            canvas, title screen markup, styling
  src/
    main.js             bootstrap, scaling, the players map, the tick
    loop.js             fixed-timestep loop + fps
    input.js            held keys in a Set; edge-triggered keys separately
    player.js           Player factory, applyMovement, applyInteraction
    room.js             room.json loading, collision and zone queries
    render.js           background, y-sorted sprites, foreground
    sprites.js          image loading (becomes faces.js)
    ui.js               title screen and HUD
    audio.js            the AudioContext, the master gain, positional volume
    sounds.js           one-shots: every recipe, and recorded overrides
    ambience.js         the three loops and their scheduler
    debug.js            the editor overlay
    net.js              multiplayer stub
    config.js           every tunable in one place
  data/
    room.json           solids, zones, spawn — generated, not hand-written
    layout-map.png      the drawing room.json came from; the real source
  assets/               room-bg.png, room-fg.png, face-01..08.png
    audio/manifest.json which sounds have a real recording behind them
  tools/
    make-placeholders.html   room art + placeholder faces
    layout-template.html     Figma starter PNG
    import-map.html          layout PNG -> room.json
  LAYOUT.md   ARTWORK.md   BACKLOG.md   README.md   CONTEXT.md
```

---

## 5. The layout pipeline

**Layouts are never hand-authored.** The drawing is the source of truth.

1. `tools/layout-template.html` downloads a 640 × 360 Figma starter — 8px grid,
   walls at true thickness, every element at true size, labelled distance bars.
2. Draw the room in Figma as flat rectangles in key colours: black wall, red
   small table, magenta big table, blue counter, cyan bar rail, yellow jukebox,
   green seat dot (optional override), orange spawn dot. Export PNG at 1×.
3. `tools/import-map.html` turns it into `room.json`. Connected shapes are cut
   back into rectangles, so an L-shaped counter keeps its empty corner.
4. Paste over `data/room.json`. Fine-tune in the debug editor (backtick) if
   needed, then Copy JSON from there.

**The drawing's colours carry meaning**, and the collision was read out of them
rather than typed in. In the garden:

| Colour | What it is | In the game |
|---|---|---|
| `#f3f1ed` pale | the outdoor table, and the doorway box | table is solid, doorway is not |
| `#ffffff` white | walkable path | floor |
| `#bab49e` tan | garden ground, a different tone so the two rooms read apart | floor |
| `#766b40` / `#b9b47c` olive | tree canopies, except the vertical one, which is the hedge | canopies go in `room-fg.png` and draw **over** people; the hedge is solid |

Trees are overhead. You walk under them and they cover you — that is what the
cover plate is for, and the garden is the first thing in it.

Full dimensions in `LAYOUT.md`. The ones that matter most:

| | |
|---|---|
| Small table | 44 × 28 |
| Big table | 64 × 40 |
| Counter | 48 deep |
| Bar rail | 16 deep, stool every 48 |
| Lane between objects | 48 minimum, 64 comfortable |
| Doorway | 88 |
| Face | 32 × 32, hovering 14 above the ground point |

**The seat rule, which is not negotiable by hand-editing:** a seat is placed on
every side of a table with clear floor beyond it. Walkable and seatable are the
same thing. Don't want a seat there? Put the table against a wall.

Each solid carries a `kind` (`wall` / `table` / `counter` / `bar` / `jukebox`)
so the art generator never guesses from geometry.

---

## 6. Art contract

**Room:** `room-bg.png` and `room-fg.png`, both 640 × 360. The rule for which
layer: *can a person stand behind this and be partly hidden by it?* → foreground.
Everything else → background. Nothing passes behind the bar rail, so it stays in
the background.

**Faces:** `face-01.png` … `face-08.png`, exactly 32 × 32, transparent, centred,
looking straight out. One drawing each — no directions, no frames. The bob is
code. Dropping in a new PNG changes that face with zero code edits.
`tools/prep-faces.html` (not built yet) will take any image at any size and
produce a correct 32 × 32.

**Palette:** cream floor, charcoal structure and line work, red for accents.
Shadows warm dark at low alpha, never pure black — black on cream reads as a
hole. Line weight 2px minimum: a face is 5% of the room's width.

Full list of what needs drawing: `ARTWORK.md`.

---

## 7. Where things stand

**Day 1 — the engine. Complete, 8 phases.** Integer scaling, fixed timestep,
pure movement and interaction, collision with per-axis resolution, zones and
seating, coffee that survives reload, title screen with localStorage, debug
editor that exports room.json.

**Day 2 — faces. 2 of 6 phases done.**

| | |
|---|---|
| ✅ 1 Strip | removed the `working` state, seat `facing`, sprite-sheet animation, every facing-dependent render path |
| ✅ 2 Placeholders | room moved to 640 × 360, generator rewritten in the palette, eight placeholder faces |
| ✅ 3 Draw | `src/faces.js` — eight faces loaded once and indexed by `faceId`, shadow then face at the ground point, y-sorted; cat sheets deleted |
| ✅ 4 Bob | distance-driven so it cannot desync from speed, settles over ~200ms, still when sitting |
| ✅ 5 Prep tool | `tools/prep-faces.html` — trims, fits and centres any drawing to 32x32 |
| ✅ 6 Title + cleanup | multiplayer audit and README rewrite (the face picker and the `catId` → `faceId` migration landed early, in phase 3) |
| ✅ 7 Jukebox | Enter stops and starts the music; the prompt says which |

**Day 3 — sound. Complete.** The café is audible. Nothing exists before the
player's first click — not a suspended context, no context at all — so autoplay
is impossible by construction rather than by policy. Seven one-shots (click,
pick, door, step, sit, stand, coffee) and three loops (room tone, jukebox,
garden), all generated at runtime out of oscillators and filtered noise: no
files, no dependency, nothing to license. Doors creak, open and close — noise
through a narrow bandpass whose centre both slides and wobbles, which is the
difference between wood and a whistle. The garden is audible only through the
doorway, because there is a wall in the way: in the café the opening is a
ceiling on the birds rather than a second source, which keeps the crossing
continuous instead of a step. Sounds are driven by the difference in
a player's state across a tick, never from `applyInteraction`, so a player
arriving over the wire will sound without new code, and everyone but you is
heard at the volume their distance earns. A footstep is a completed bob cycle,
so the sound and the sight of a step are the same number.

Sitting down sounds like working — scribbling or typing, the habit derived from
`faceId` so nothing needs syncing — and a coffee is drunk rather than counted:
two minutes from the counter, sipped only at a table, picked back up if you sit
down again before it goes cold. `isWorking()` in `player.js` is the single hook
the menu's focus time narrows; every desk sound already asks it, so they all
stop when a session's timer does.

**The faces build is finished.** All eight hand-drawn faces are in, bobbing as
they walk. No placeholder art remains for the people; only the room is still
generated. Next up is room artwork, then whatever in `BACKLOG.md` you want.

**Current room:** imported from a Figma drawing. Lounge with four tables — one
long one across the top — an L-shaped coffee counter, jukebox by the entrance,
garden through a doorway, L of bar rail with stools. **21 seats.**

---

## 8. Settled decisions — don't reopen without a reason

| Decision | Why |
|---|---|
| 640 × 360, raised from 480 × 270 | the room has to hold twelve people and let them run |
| A seated face turns to its table | reverses the line below for the one case Soha asked for. A front-facing portrait rotated 180° reads as lying on its back, and that cost was put plainly before the call was made. Walking, standing and idling are all still face-on |
| Sound keeps playing in a hidden tab | you put the café on and go and work in another tab; that is the whole use. It forced the ambience scheduler off the game's tick, since a hidden tab stops painting frames — it runs on its own timer with a 2.5s lookahead, longer than a throttled background timer can fall behind |
| Faces, not sprite sheets | a hand-drawn face can't turn without a second drawing, so it doesn't turn; everyone looks at the viewer and that's the point |
| Two states only: `walking`, `sitting` | `working`, seat `facing` and the laptop square were removed deliberately |
| Seats on every open side | fixes "I can walk round that end but can't sit there" |
| The counter is not seating | you stand and order; red bands mark the faces you can order from |
| Tables drawn at their true collision rect | they used to be a circle inscribed in a bigger rect, so you bumped into nothing |
| The jukebox faces whichever side has most standing room | people queue at it |
| Layout comes from a drawing, not from code | I was inventing layouts nobody wanted |
| Small talk over voice chat | see `BACKLOG.md`; voice means consent, moderation and a bill that scales with popularity, for a feeling text mostly delivers |
| Whole-number scaling below 2x dpr, fill at or above it | "never fractional" was protecting against uneven pixels, not against fractions. On a 1x screen a 2.36x scale is glaring; on a retina one it disappears into the device pixels, and a 640x360 game marooned in a black box on a large display is the worse problem |
| No dependencies, no build step | the folder must stay droppable anywhere |
| A room has one volume | the café does not get quieter at the counter or in the middle of the floor. Distance inside a space was tried and was wrong: it made the room feel like a set of pools rather than a place. Only a wall attenuates, and the doorway is the one hole in it |
| `working` is a predicate, never a state | `isWorking()` asks a question about the two states that exist. Reintroducing a third was the mistake that seat facing and the laptop square came with |
| A coffee lasts two minutes | a bottomless cup is odd once you notice it, and a tally that only goes up is not a thing you are holding. It counts down whether you are sitting or not, and it does not survive a reload |
| You sit only where a stool is drawn | the garden rail generated stools every 48px along its length whether or not one was drawn there. The five in the garden are now the five Soha drew, found as dark blobs on the pale floor rather than typed in |
| No in-game mute or volume control | the OS has a volume key and the browser has a tab mute; both are better than anything the café could draw in a corner, and neither needs building, persisting or explaining |
| Sound synthesized, not sampled | the same move `make-placeholders.html` makes for the room: something real to work against now. Recordings drop in later via `assets/audio/manifest.json` with no code change |
| Sound driven by state changes, not by input | `applyMovement` and `applyInteraction` must stay pure for the server; reading the difference in `main.js` also makes remote players audible for free |

---

## 9. Bugs already hit — don't reintroduce

- **A player changing face and vanishing.** Art was cached per player instead of
  per face id. Load all eight up front, index into them.
- **Full-width shapes wrapping rows.** The importer's run-scan didn't stop at the
  row end, so the top and bottom walls disappeared into one giant rectangle.
- **The art generator guessing what a solid was from geometry.** It decided the
  bottom wall was a counter and drew stools along it. Solids carry `kind` now.
- **A global `canvas` CSS rule** painting the title screen's face previews solid
  black. Scope styles to `#game`.
- **Seats placed inside the table**, which drew the person on top of the table.
- **A Next rewrite instead of a redirect** for `/cafe` — a rewrite keeps the URL
  at `/cafe`, so every relative path resolved one directory too high.
- **Autoplay.** Nothing may make noise before the player interacts.
- **A bob that only worked for the local player.** Judging "are they walking"
  from this tick's movement works for a keyboard, which moves a little every
  tick, and fails for snapshots, which move a lot on one tick and nothing on the
  next few. A player now keeps counting as walking for a moment after their last
  movement.

---

## 10. Open questions

- Walk speed is 60px/s and untested for feel in the bigger room; ~80 may be
  better. Shift-to-run is a ten-minute job and not done.
- A 23px dead pocket between the counter and the dividing wall — looks like a
  route, isn't one.
- The garden is ~100px of usable floor once the rail is in. Tight.
- Focus time is the biggest idea and undefined: what does the end of a session
  actually do, and are "beepers" a timer ending or something you send someone?
- The empty room: someone arriving alone at 3am must not feel like they found an
  abandoned site. Decide before multiplayer architecture sets around it. The
  room tone is the first answer to this — it is what they hear instead of
  nothing.
- **Whose jukebox is it?** Switching it off currently switches it off for
  everyone in the room, which is what a real café does and is also one stranger
  silencing another. The alternative is a per-listener preference that does not
  travel, which is safer and less like a place.
- Doors and the garden both live in `AUDIO` in config rather than in
  `room.json`, because the layout colour key has no colour for either. The
  proper fix is a door colour in `LAYOUT.md` and `import-map.html` so the
  drawing stays the single source of truth — worth doing before there are many
  more of them.
- The music is four chords at 68bpm generated at runtime. Whether the café ever
  gets real tracks is a question about taste and rights, not about code.
- `main` still has a placeholder `app/cafe/page.jsx` holding the `/cafe` URL.
  When the game takes that address, that page and the redirect in
  `next.config.mjs` come out together.

---

## 11. How to work on this

- **Stop after each phase**, say what to check, wait for confirmation.
- **Verify in a real browser before claiming it works** — this project's bugs
  have overwhelmingly been visual, and unit tests missed every one of them.
- **Don't invent room layouts.** Use the drawing pipeline.
- **Don't add dependencies** to the game folder.
- Every tunable belongs in `config.js`, not inlined at a call site.
- Judgement calls that are the owner's, not the assistant's: does it *feel*
  right (walk speed, bob amount, zone generosity), does it *look* right (the
  drawings, the palette), and the layout itself.

**Multiplayer:** sketched in `MULTIPLAYER.md`. The short version is that a relay
is enough — nobody has a motive to cheat at sitting in a chair — and that the
`net.js` stub currently assumes the opposite, so its three functions change
meaning when it lands.

**Companion docs:** `LAYOUT.md` (dimensions and the colour key), `ARTWORK.md`
(what needs drawing), `BACKLOG.md` (everything not yet built, with sizes and a
suggested order), `README.md` (running, deploying, swapping art).

# The Café — project context

Paste-into-a-Claude-Project brief. Everything a fresh session needs to be useful
without re-deriving decisions or re-litigating settled ones.

Last updated: 20 September 2026.

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
  holdingCoffee, coffees }`. No methods, no DOM or canvas references. `faceId`
  is 1–8. `dir` is local-only and must never reach the draw path.
- **Room state and render state are different objects.** Positions and states in
  the player; bob phase and interpolation in a render-state map keyed by player
  id, created lazily so someone appearing mid-session gets one.
- **`applyMovement(player, input, dt, collision) -> {x, y}` and
  `applyInteraction(player, input, room, taken) -> {…}` are pure.** State in,
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
    debug.js            the editor overlay
    net.js              multiplayer stub
    config.js           every tunable in one place
  data/
    room.json           solids, zones, spawn — generated, not hand-written
    layout-map.png      the drawing room.json came from; the real source
  assets/               room-bg.png, room-fg.png, face-01..08.png
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
| ⬜ 6 Title + cleanup | multiplayer audit, README (the face picker and the `catId` → `faceId` migration landed early, in phase 3, since the title screen had to keep working) |
| ⬜ 7 Jukebox | zone exists, no behaviour |

**All eight hand-drawn faces are in**, bobbing as they walk. No placeholder art
remains for the people; only the room is still generated.

**Current room:** imported from a Figma drawing. Lounge with four tables — one
long one across the top — an L-shaped coffee counter, jukebox by the entrance,
garden through a doorway, L of bar rail with stools. **21 seats.**

---

## 8. Settled decisions — don't reopen without a reason

| Decision | Why |
|---|---|
| 640 × 360, raised from 480 × 270 | the room has to hold twelve people and let them run |
| Faces, not sprite sheets | a hand-drawn face can't turn without a second drawing, so it doesn't turn; everyone looks at the viewer and that's the point |
| Two states only: `walking`, `sitting` | `working`, seat `facing` and the laptop square were removed deliberately |
| Seats on every open side | fixes "I can walk round that end but can't sit there" |
| The counter is not seating | you stand and order; red bands mark the faces you can order from |
| Tables drawn at their true collision rect | they used to be a circle inscribed in a bigger rect, so you bumped into nothing |
| The jukebox faces whichever side has most standing room | people queue at it |
| Layout comes from a drawing, not from code | I was inventing layouts nobody wanted |
| Small talk over voice chat | see `BACKLOG.md`; voice means consent, moderation and a bill that scales with popularity, for a feeling text mostly delivers |
| No dependencies, no build step | the folder must stay droppable anywhere |

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
  abandoned site. Decide before multiplayer architecture sets around it.
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

**Companion docs:** `LAYOUT.md` (dimensions and the colour key), `ARTWORK.md`
(what needs drawing), `BACKLOG.md` (everything not yet built, with sizes and a
suggested order), `README.md` (running, deploying, swapping art).

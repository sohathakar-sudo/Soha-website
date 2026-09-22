# Artwork list

Everything the café needs drawn, at the size it ships at. The room is authored
at **640 × 360** and scaled up by whole numbers, so 1px here is 1px on screen at
1×, 2px at 2×. Nothing is ever scaled fractionally.

**Line weight: 2px minimum.** A face is 32px in a 640px-wide room — about 5% of
the width. Hairlines disappear.

**Palette:** cream floor, charcoal structure and line work, red for accents.
Shadows are warm dark at low alpha, never pure black — black on cream reads as a
hole.

---

## 1. The two room layers — required

| File | Size | Holds |
|---|---|---|
| `room-bg.png` | 640 × 360 | the floor and everything that never covers a person |
| `room-fg.png` | 640 × 360 | only what should cover a person standing behind it; transparent everywhere else |

The rule that decides which layer something goes in:

> Can a person stand **behind** this and be partly hidden by it? Foreground.
> Everything else — including anything nobody can walk behind — background.

A tall object spanning half the room can't be sorted sensibly, so the bar rail
stays in the background and nothing passes behind it.

### What goes in the floor plate (`room-bg.png`)

| Element | Size | Notes |
|---|---|---|
| Café floor | fills the lounge | flat, or a quiet pattern — it sits under everything, so keep contrast low |
| Garden floor | fills the garden | a different tone, so the two rooms read as two rooms |
| Back wall | 640 × 48 | the band across the top |
| Side and bottom walls | 8 thick | |
| Dividing wall | 8–20 thick | with the doorway gap left open |
| Doorway markings | ~4 × 8 ticks | on the floor either side of each opening |
| Café entrance | 40 × 80 | the door and its threshold, bottom-left |
| Garden entrance | 40 × 80 | top of the dividing wall |
| Tables | 44 × 28 small, 64 × 40 big | drawn at exactly the rect that blocks you |
| Chairs | ~14 × 14 | one at each seat position |
| Coffee counter | 48 deep, L-shaped | plus a band on each face you can order from |
| Bar rail | 16 deep, two runs | |
| Bar stools | ~10 across | one per seat |
| Jukebox | 40 × 24 | one landmark; the queue side faces the lounge |

### What goes in the cover plate (`room-fg.png`)

| Element | Notes |
|---|---|
| The back edge of every table | so someone at the far side is drawn behind it |
| The counter's front lip | anyone behind the counter is partly hidden |
| Hanging things | lamps, a ceiling fan, bunting — anything above head height |
| A parasol or awning in the garden | if you draw one |
| Doorframe tops | if the doorways get depth |

---

## 2. Props — optional, and the nicer way to work

Right now every object is painted into the two room plates, so changing one
means re-exporting the whole room. A small addition to `room.json` would let you
drop individual PNGs instead:

```json
"props": [
  { "image": "plant.png", "x": 120, "y": 200, "layer": "bg" },
  { "image": "lamp.png",  "x": 300, "y": 60,  "layer": "fg" }
]
```

Placeable in the debug editor, swappable one file at a time, and each prop can
be y-sorted with people instead of being stuck in a layer. **This is a small code
change and worth doing before you draw a lot of small objects.**

Prop ideas, with sizes that suit the room:

| Prop | Size | Where |
|---|---|---|
| Potted plant | 16 × 24 | corners, beside the counter |
| Tall plant | 20 × 36 | garden, foreground candidate |
| Rug | 64 × 40 | under a cluster of tables |
| Coffee machine | 24 × 16 | on the counter |
| Cups and saucers | 6 × 6 | counter, tables |
| Cake stand | 12 × 14 | counter |
| Menu board (A-frame) | 20 × 28 | by the entrance, near the counter |
| Wall clock | 16 × 16 | back wall — useful once focus time exists |
| Shelf of books | 48 × 20 | back wall |
| Window | 48 × 32 | back wall |
| Pendant lamp | 16 × 20 | foreground, above tables |
| Hedge / fence | 16 deep | garden edge |
| Fairy lights | any length | garden, foreground |
| Bird | 8 × 8 | garden — **the chirping exists now**, so this one has something to be the face of |
| Speaker | 10 × 14 | near the jukebox — **the music exists now**, and it comes from a point in the room, so a speaker is where it looks like it comes from |
| Feedback box | 12 × 12 | on the counter |
| Tip jar | 8 × 10 | on the counter |
| Notice board | 32 × 24 | wall — a home for the to-do list idea |

---

## 3. The people

| File | Size | Notes |
|---|---|---|
| `face-01.png` … `face-08.png` | 32 × 32 | transparent, face centred, looking straight out |

One drawing each. No directions, no frames — the bob is code. Draw one, run it
through `tools/prep-faces.html`, look at it in the room at 1×, and only then
commit to a style for the other seven.

---

## 4. Interface art

Small, and easy to forget until the room feels unfinished without it.

No mute or volume icon: the café deliberately has no audio controls of its own —
the operating system and the browser tab already do that job.

The jukebox now wants a drawn *on* and *off* state, or a small indicator beside
it. Enter toggles the music and the only feedback is the music itself, which is
thin when you are standing far enough away that it was already quiet.

| Element | Size | For |
|---|---|---|
| Coffee cup icon | 8 × 8 | the HUD counter |
| Speech bubble | 9-slice, ~16 × 12 min | "say hi", hover copy |
| To-do list icon | 24 × 24 | bottom-right corner |
| Settings icon | 24 × 24 | |
| Voice chat icon | 24 × 24 | three states: off, listening, talking |
| Focus timer pip | 8 × 8 | beside a seated person, or in the HUD |
| Favicon | 32 × 32 | currently blank |
| Open Graph card | 1200 × 630 | so the link doesn't unfurl as a grey box |

---

## 5. Order to draw in

1. **One face.** Check it in the room at 1× before drawing the rest.
2. **The floor plate** — floor, walls, doorways. The room stops looking like a
   diagram immediately.
3. **Furniture** — tables, chairs, counter, bar, jukebox.
4. **The cover plate** — table backs, counter lip, anything hanging.
5. **The other seven faces.**
6. **Props**, once the props system exists.
7. **Interface art**, alongside the features that need it.

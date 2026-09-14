# Layout legend

Every dimension you need to design the room, and how to hand a layout back so it
becomes `room.json` without anyone typing coordinates.

All numbers are in room pixels. The room is authored at **640 × 360** and scaled
up by whole numbers at runtime (2× on a 1280-wide window, 3× on 1920). Design at
640 × 360 exactly.

---

## A person

This is the unit everything else is measured against.

| | |
|---|---|
| Face PNG | **32 × 32**, transparent, face centred |
| Ground point `(x, y)` | the spot on the floor they stand on — *not* the centre of the face |
| Face is drawn | centred at `(x, y − 14)`, so it occupies **x−16…x+16, y−30…y+2** |
| Bob | ±2px vertical while walking |
| Collision box | **16 wide × 8 tall**: `x−8…x+8, y−8…y` |
| Shadow | ellipse **16 × 5** at the ground point |
| Walking speed | 60 px/s — 10.7s to cross the room, 0.8s to cross a 48px lane |

**For layout purposes a person is a 32-wide column standing on an 8px foot, and
their head reaches 30px above where they stand.** Anything within 30px above a
seat will be overlapped by the face sitting there.

---

## The three layers that define a piece of furniture

This is the distinction that produced the "you can walk around the table but
can't sit on that side" problem. Every seatable object needs all three.

1. **Solid** — the rectangle that blocks movement. The tabletop itself.
2. **Zone** — where pressing Enter does something. Must cover **every side you
   can stand on**, not just one.
3. **Seats** — the exact points you snap to. A list, one entry per person.

Rules, enforced by the importer:

- A zone extends **≥ 20px beyond its solid** on every side that has a seat.
- Every seat lies **inside its own zone** and **outside every solid** (a seat
  inside a solid is unreachable — you can never stand there to press Enter).
- Seats belong to the zone they sit inside. Two zones must not overlap.

---

## Furniture sizes

Recommended, not enforced. The importer takes whatever you draw.

### Big table — 4 seats

| | |
|---|---|
| Solid | 64 × 32 |
| Seats | 4: above, below, left, right of the tabletop |
| Seat offset | 14px clear of the tabletop edge, centred on that edge |
| Zone | solid grown by 26px on all four sides → **116 × 84** |

With a 64-wide top you can also put **two seats along the long sides** — centres
36px apart — for a six-seater. Faces are 32 wide, so 36 apart is the tightest
spacing that doesn't overlap.

### Small table — 2 seats

| | |
|---|---|
| Solid | 44 × 28 |
| Seats | above and below |
| Zone | solid grown by 26px → **96 × 80** |

### Counter

| | |
|---|---|
| Solid | length × 20 deep |
| Service zone | 40px deep along the approach side |
| Stools (optional) | seats every **36px** along the approach side, 14px off the counter edge |

A counter with seats behaves exactly like a table: Enter takes the nearest free
stool. A counter with no seats only serves coffee.

### Bar run

| | |
|---|---|
| Rail solid | 16 deep, any length |
| Stools | every **48px** along it |
| Seat offset | 14px off the rail |
| Zone | 40px deep along the seated side |

Leave the corner of an L empty — start the stools a full seat-width in, or it's
ambiguous which run a seat belongs to.

### Jukebox

| | |
|---|---|
| Solid | 24 × 32 |
| Zone | 40 × 40 on the approach side |

---

## Spacing minimums

| | |
|---|---|
| Walking lane between any two obstacles | **48px** comfortable, 40px absolute floor |
| Two seats side by side | **36px** centre to centre |
| Behind a seat (space to pull out and stand) | 24px |
| Floor between a wall and the first furniture | 24px |
| Wall thickness | 8px at the room edge, 20px for a dividing wall |
| Doorway opening | 90px |

Twelve people at 32px wide each need somewhere to be: 16 seats, and enough open
floor that the room doesn't feel solved. The empty middle is the feature.

---

## Handing a layout back

Draw a **layout map**: a 640 × 360 frame of flat colour blocks, one per element.
It is not artwork — it's data I can read. Room art is separate, and comes later.

### The colour key

Exact RGB, flat fills, **no anti-aliasing, no gradients, no opacity**.

| Colour | Hex | Means |
|---|---|---|
| Magenta | `#FF00FF` | solid — blocks movement |
| Cyan | `#00FFFF` | table zone |
| Yellow | `#FFFF00` | counter zone |
| Green | `#00FF00` | bar zone |
| Orange | `#FF8000` | jukebox zone |
| Red | `#FF0000` | a seat — one small square, 4 × 4 is plenty |
| Blue | `#0000FF` | spawn point — one square |
| anything else | | ignored |

### Rules for drawing it

- Axis-aligned rectangles only.
- Zones sit **on top of** the solids they belong to — draw the zone, then the
  solid inside it, then the seat squares. Overlap is expected and correct.
- Don't let two zones touch or overlap each other.
- Seat squares go on floor you can actually stand on, never on a solid.

### In Figma

- Frame exactly 640 × 360.
- Export **PNG at 1×**. If you export at 2× or 4× it still works — I downscale
  with smoothing off — but 1× is exact.
- Turn off any layer blur, shadow or opacity. A 99%-opacity magenta is not
  magenta.

### Then

Open `tools/layout-map.html`, drop the PNG in, and it prints the finished
`room.json` with a Copy button, plus warnings for anything that violates the
rules above. Paste it over `data/room.json`.

The same page exports the **current** room as a layout map PNG, so you can start
from what exists rather than a blank frame.

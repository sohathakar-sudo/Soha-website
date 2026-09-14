# Layout kit

Everything you need to draw the room in Figma and have it become `room.json`
exactly, with no coordinates typed by hand.

The room is **640 × 360**. One pixel here is one pixel in the game. Work at 1×
in Figma and export at 1×.

---

## 1. The colour key

Draw the layout as flat rectangles. The colour *is* the element type.

| Element | Colour | Hex | What it becomes |
|---|---|---|---|
| Wall / any solid obstacle | black | `#000000` | a collision rect, nothing else |
| Table, small | red | `#FF0000` | solid + table zone + a seat on every open side |
| Table, big | magenta | `#FF00FF` | solid + table zone + a seat on every open side |
| Coffee counter | blue | `#0000FF` | solid + counter zone on the open side |
| Bar rail | cyan | `#00FFFF` | solid + bar zone + a stool every 48px |
| Jukebox | yellow | `#FFFF00` | solid + jukebox zone beside it |
| Seat (optional) | green dot | `#00FF00` | one seat exactly there — overrides the automatic ones |
| Spawn | orange dot | `#FF8000` | where players arrive |
| Floor | anything else | — | ignored; use white |

Rules for the export, because the importer reads raw pixels:

- **Flat fills only.** No opacity, no gradients, no shadows, no strokes, no
  corner radius, no rotation.
- **Export PNG at 1×**, 640 × 360, no background effects.
- Slight anti-aliasing at edges is fine — colours are matched by nearest
  neighbour and stray edge pixels are ignored.
- Two rectangles of the same colour that touch read as **one** object. Leave at
  least 1px between them.
- **L-shapes are fine.** A counter or bar drawn as an L is cut back into
  rectangles, and the empty corner stays empty.

You only draw the **objects**. Zones and seats are computed — that's what stops
the "you can walk round that side but can't sit there" problem.

---

## 2. Sizes

### The person

| | |
|---|---|
| Face PNG | 32 × 32 |
| Visible head inside it | about 24 across |
| Hover — face centre above the ground point | 14 |
| Bob | ± 2 |
| Ground point | the spot on the floor; collision, seating and depth all use it |
| Collision box | 16 × 8, centred on the ground point, extending *up* from it |

A face is 5% of the room's width. Thick lines, bold shapes — fine pen work
disappears.

### Furniture

| Element | Size | Notes |
|---|---|---|
| Table, small | **44 × 28** | put it against a wall and it seats two |
| Table, big | **64 × 40** | free-standing, so it seats four |
| Coffee counter | **48 deep**, 96–160 long | you stand at it; no seats |
| Bar rail | **16 deep**, any length | stools every 48 along it |
| Jukebox | **24 × 40** | one landmark, don't make it bigger |
| Outer wall | **8 thick** | |
| Internal dividing wall | **16–20 thick** | |

### Distances — these are the ones that decide whether it feels right

| | Minimum | Comfortable |
|---|---|---|
| Walking lane between two objects | **48** | 64 |
| Main route across the room | 64 | **80** |
| Doorway width | **88** | 96 |
| Between two seats | 24 | **36** |
| Seat back to the wall behind it | 16 | 24 |
| Table edge to seat (computed for you) | 14 | |

48 is two people passing: each is 16 wide with clearance either side. Anything
under it reads as a squeeze, which is occasionally what you want and usually
not.

The two table colours behave identically — the colour only tells you which size
you meant. How many seats a table gets is decided by where you put it, not by
which red you used: a table with its back to a wall seats two or three, one out
in the open seats four.

### Seat placement, computed

For every table, the importer looks at all four sides and places a seat on
**each side that has clear floor beyond it**. So if you can walk round that end
of the table, you can sit at that end. That is the rule, and it is not
negotiable by hand-editing — redraw the table so the side is blocked if you
don't want a seat there.

| Side | Seat position |
|---|---|
| South | table centre x, `table.y + table.h + 14` |
| North | table centre x, `table.y - 12` |
| West | `table.x - 14`, table centre y + 8 |
| East | `table.x + table.w + 14`, table centre y + 8 |

Bar stools sit **12 out** from the rail on its open side, spaced **48** apart,
starting a full 48 in from each end so an L-shaped corner is never ambiguous.

### Zones, computed

A zone is the area you stand in for `Enter` to do something. It is always
**bigger than the object** — that's what makes interaction feel generous rather
than fussy.

| Zone | Extent |
|---|---|
| Table | the table grown by 24 on every side, so it covers every seat |
| Counter | a 40-wide strip along **every** open side, so an L-shaped counter can be ordered from on both faces |
| Bar | the rail plus 32 on the stool side |
| Jukebox | a 40-wide strip on the open side |

---

Each solid in the exported JSON carries a `kind` — `wall`, `table`, `counter`,
`bar` or `jukebox`. The game ignores it; the placeholder art generator uses it to
know what to draw, so it never has to guess a wall from a counter by geometry.

## 3. The workflow

1. Open `tools/layout-template.html`, download **layout-template.png** — a
   640 × 360 frame with an 8px grid, the colour key, and every element drawn at
   true size to copy.
2. In Figma, drop it in as a locked bottom layer. Draw your layout over it with
   flat rectangles in the key colours.
3. Export your layout as a 640 × 360 PNG at 1× — the key layer hidden, floor
   white.
4. Open `tools/import-map.html`, drop the PNG in. It shows what it found, warns
   about lanes under 48, seats inside walls, tables with an unseatable open
   side, and anything it couldn't identify.
5. **Copy JSON** → paste over `data/room.json`. Refresh the game.
6. Nudge anything by hand in the debug editor (`` ` ``), then Copy JSON from
   there.

Redrawing and re-importing takes seconds, so iterate on the drawing rather than
on the JSON.

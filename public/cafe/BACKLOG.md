# Backlog

Everything not yet built, grouped by what it depends on. Sizes are rough:
**S** an evening, **M** a few sessions, **L** a project of its own.

---

## In flight — the faces phases

| | |
|---|---|
| Draw faces (`faces.js`, shadow, ground point, y-sort) | S |
| Bob (distance-driven, settles, still when sitting) | S |
| `prep-faces.html` — any image → 32 × 32 face PNG | S |
| Title screen face picker, `catId` → `faceId` migration, README | S |

## Artwork

See `ARTWORK.md` for the full list. The short version: two room plates, eight
faces, then props and interface icons.

| | |
|---|---|
| One face, checked in the room before the rest | S |
| Floor plate — floor, walls, doorways | M |
| Furniture — tables, chairs, counter, bar, jukebox | M |
| Cover plate — table backs, counter lip, hanging things | S |
| The other seven faces | M |
| **Props system** — `props` in room.json, placeable in the editor | S |
| Individual prop art | M, ongoing |
| Interface icons | S |

---

## Sound

All of it needs the same two things first: a **mute control that persists**, and
a rule that **nothing plays until the player interacts** — browsers block
autoplay, and a site that makes noise on load is rude.

| | |
|---|---|
| Mute toggle + persisted preference | S — do this first |
| Jukebox music, curated tracks | M — must be yours or licensed |
| Jukebox selection screen on Enter | M |
| Volume by x position, so music fades into the garden | S |
| Garden chirping, looped, volume by position | S |
| Door bell when you enter the café | S |
| Click sound on every click | S |
| Footstep and sit sounds | S |

## Focus time — the reason to be there

This is the one that turns the café from a toy into a place with a purpose.
Coffee already exists and already persists; this gives it meaning.

| | |
|---|---|
| Café menu that sets a focus duration | M |
| Focus mechanism — timer, what happens at the end, what a "session" is | M |
| To-do list you fill in when you sit down | M |
| To-do list icon, bottom-right | S |
| Click a person → say hi, see what they're working on | M — needs multiplayer for other people |

Open question worth settling before building: what does the end of a focus
session actually do? A chime, a visible state on your face, a tally? And do
"beepers" mean a timer ending, or something you send another person?

## Social and polish

| | |
|---|---|
| Witty copy on hover | S |
| Feedback box as an object in the room, not a form in a corner | S — do it **before** strangers arrive |
| Side panel — controls, change face, mute, what-is-this, link home | S — also answers "how does anyone know to press Enter" |
| Settings | S–M — hosts mute, theme, reduced motion |
| Themes | M — needs the palette to be tokens first |
| Walk speed increases with Shift | S |

## Larger, decide before starting

| | |
|---|---|
| Multiplayer — server, snapshots, interpolation, reconciliation | L |
| Voice chat you can tune into and leave | L |

**Voice chat is the riskiest item here.** Live audio between strangers on a
personal site means consent, moderation and a bill that scales with usage. If it
happens: opt-in only, push-to-talk, visibly indicated to everyone in the room,
and easy to leave. Worth deciding whether you want that liability before any of
it gets built.

---

## Easy to forget

- Favicon and page title
- Open Graph tags
- Tab-away handling — a backgrounded tab throttles the loop; a returning player
  shouldn't teleport or stick
- Your name on it somewhere unobtrusive, with a link home and a one-line
  "what is this"
- The empty room: someone arriving alone at 3am must not feel like they found an
  abandoned site

---

## Suggested order

1. Finish the faces phases — the game is mid-change until they land.
2. Props system, then the floor plate. The room stops looking like a diagram.
3. Walk speed on Shift. Ten minutes, and the bigger room needs it.
4. Mute control, then the door bell and garden chirping. Small, and sound does
   more for atmosphere than any amount of extra furniture.
5. Side panel and feedback box — before anyone else sees it.
6. Focus time. The biggest idea, and the one that decides what the café is for.
7. Jukebox with curated tracks.
8. Multiplayer.
9. Voice chat, if you still want it by then.

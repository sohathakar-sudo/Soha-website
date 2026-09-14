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

## Small talk

Ephemeral text between people in the room. Cheap — it rides the same connection
as the game state, a message is a few hundred bytes against position updates
sent ten times a second — so the cost question is settled and only the design
matters.

Press `/` to type. Click a person first and the bubble points at them.

| Setting | Default | Why |
|---|---|---|
| Visibility | a bubble anyone nearby can read, not a private message | a channel between two strangers with no witnesses is where harassment lives; in a room where everyone sees it, behaviour self-polices |
| Length | 180 characters | 300 is a paragraph; 180 makes brevity structural |
| On screen | 4s + 60ms per character, capped at 12s | 8 seconds is under half the time needed to read 300 characters |
| Rate limit | one message per 5 seconds | |
| Repeat rule | you cannot send to the same person twice until they reply | stops one-way pestering, which is the actual failure mode |
| Proximity | sender must be within a short radius | no shouting across the room |
| Mute | per person, client-side, kept in `localStorage` | |
| Report | the reporter's browser keeps the last few messages and sends them only if they hit report | keeps the no-logs stance while leaving someone who is abused with something to report |
| Server | forwards, never stores | nothing at rest means nothing to moderate, leak or retain |
| Profanity filter | none | word lists are bypassed in seconds and give false confidence |

Ephemerality buys a lot — no archive, no retention policy, almost no privacy
surface — but it does not make a message unsaid. The recipient can screenshot,
and someone being unpleasant is still being unpleasant. The report buffer is
what keeps "no memory" from meaning "no recourse".

| | |
|---|---|
| Bubble rendering, `/` input, length and timing, mute plumbing | S — buildable solo, testable on your own face |
| Wiring it to other people | S, once multiplayer exists |
| Report buffer and per-person mute | S |

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

If small talk lands well, the case for voice weakens considerably: it delivers
most of the "someone is here with me" feeling for none of the cost and a
fraction of the risk.

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
8. Multiplayer — which is also what makes small talk mean anything. Build the
   bubble UI before then; it is testable solo.
9. Voice chat, if you still want it by then.

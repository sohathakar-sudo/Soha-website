# Multiplayer, the cheap way

A sketch, not a build. Enough to start from and enough to argue with.

The goal is the feeling in `CONTEXT.md` §1 — *somebody else is here with me* —
for as close to nothing as it can be done. That turns out to be genuinely close
to nothing, for a reason that is about the café rather than about hosting.

---

## 1. A relay, not an authority

Two designs. Only one of them is a weekend.

**Authoritative.** A server runs the simulation, clients send input, the server
sends back the truth. Nobody can cheat. It needs reconciliation — the local
player predicts, the server corrects, and the correction has to be absorbed
without the picture jumping. `CONTEXT.md` §3 already names this as the hard
part, and it is.

**Relay.** Everyone simulates themselves and broadcasts their own state. The
server forwards messages and knows nothing about cafés. Anyone could claim to be
standing anywhere.

**Take the relay.** The thing being protected is a chair in a drawing. There is
nothing to win by lying, no score, no scarcity — twenty-one seats and nobody
queuing. Paying for an authoritative server here is paying to prevent a crime
with no motive.

If the café ever grows something worth cheating at, this decision gets revisited
with something concrete to protect. Not before.

---

## 2. You do not need a server

A relay forwards messages. That is a hosted commodity — pub/sub with WebSockets,
which several services give away at the scale a personal site operates at.
Ably, Supabase Realtime, PartyKit, Deno Deploy all fit the shape.

**Check the current free limits yourself.** They change often, and the one that
matters is not concurrent connections but *messages per month*.

What to look for, in order:

| | |
|---|---|
| Messages per month | the binding constraint — see §3 |
| Does the free tier sleep? | **disqualifying.** A café that disconnects you when it is quiet is worse than no café |
| Presence built in | saves writing join/leave and timeouts by hand |
| One room, or many | one is enough, and one is cheaper |

Everything else — the game, the art, the sound — stays exactly where it is, a
static folder on Vercel. Only the messages go elsewhere.

---

## 3. Send on change, not on a clock

This is the whole cost story, and it is not a trick.

The reflex is to broadcast position ten times a second. One person connected
around the clock is then about 26 million messages a month, which is over most
free tiers before anybody else turns up.

But **a café is people sitting still.** That is the entire point of the room.
Somebody arrives, walks for eight seconds, sits down, and works for an hour. A
clock-driven design spends that hour repeating *still sitting, still sitting,
still sitting* — and paying for it.

So: send when the state changes, and not otherwise.

- Seated and working — **nothing**, indefinitely
- Walking — while they walk, and then stop
- Sitting, standing, buying a coffee — one message each
- A heartbeat every 15s or so, only to prove the connection is alive

An hour of someone working costs a few hundred messages instead of tens of
thousands. The traffic collapses, and it collapses hardest in exactly the case
the café is designed to produce.

This is also just a better description of what is happening. The room is mostly
still. The messages should be too.

---

## 4. What travels

The `Player` object is already the wire format — plain fields, no methods, no
DOM. Two things do not belong on it:

- **`leaving`** is a flag read between ticks on the machine that set it. It is
  local business and must be stripped before sending.
- **`music`** is the jukebox, and it is shared room state rather than one
  person's. See §8 — it needs a decision before it is broadcast, not after.

Everything else goes: `id, name, faceId, x, y, state, holdingCoffee, coffees,
coffeeLeft`.

`name` is typed by a stranger and shown to strangers. It is capped at 16
characters today, which is a length limit and not a content one.

---

## 5. Two things in the current code will bite

Both are real, both are small, and both are invisible until someone else
connects.

### The snapshot handler overwrites you

`main.js` upserts every player a snapshot names, the local one included:

```js
const existing = players.get(incoming.id);
if (existing) Object.assign(existing, incoming);
```

Against an authoritative server that is correct — that *is* reconciliation. In a
relay it is a bug: your own position would be replaced by an echo of where you
were when the message left, and walking would feel like wading. **The local id
must be skipped.**

This is the stub showing its assumptions. `net.js` was written expecting an
authoritative server: `sendInput(input, tick)` and `onSnapshot(authoritative)`.
A relay inverts both — you send your own *state*, and you receive *other
people's*. The three call sites stay where they are; their meanings change.

### Everyone else will arrive in bursts

Messages land a few times a second, not sixty. Assigning positions straight from
them makes remote players jump.

The bob is already ready for this — `FACE.coastSeconds` exists precisely because
judging "are they walking" from one tick's movement failed for snapshot-driven
players, and `CONTEXT.md` §9 records the bug. What is missing is the movement
itself: render state needs a target position, and the draw path needs to walk
towards it rather than snap. Render state is the right home — it never travels,
and it is already created lazily for anyone appearing mid-session.

---

## 6. Roughly the shape

```
net.js
  connect(room, identity)      open the socket, announce yourself
  publish(player)              called only when the local player changed
  onPeer(handler)              someone else's state arrived
  onGone(handler)              someone left, or went quiet
  isConnected()
```

And in `main.js`, once per tick:

```js
const mine = strip(players.get(LOCAL_ID));
if (changed(mine, lastSent)) { net.publish(mine); lastSent = mine; }
```

`changed()` is a field comparison with a small tolerance on `x`/`y`, so that
sub-pixel drift does not count as news. The sound layer already does exactly
this kind of before/after diffing — this is the same idea pointed at the wire.

---

## 7. Order of work

1. **Two clients, one room, positions only.** No interpolation, no polish — just
   prove two browsers can see each other. Everything after this is refinement.
2. **Interpolation.** The difference between a demo and a place.
3. **Send-on-change.** Do it early: it shapes the message format, and retrofitting
   it means revisiting everything.
4. **Presence and timeouts.** People close laptops; they do not press the mat.
5. **The empty room.** See §8.

---

## 8. What multiplayer does not solve

Three things that get harder the moment a second person arrives, none of which
are code:

**The empty room.** Already open in `CONTEXT.md` §10. Somebody arriving alone at
3am must not feel like they found an abandoned site. Multiplayer makes this
worse, not better, because now emptiness is visible.

**The jukebox.** Shared today: one person can silence the room for everybody.
Invisible alone, contentious immediately. Either make it a per-listener
preference that does not travel, or accept that it is a shared object and let
people fight over it like a real café.

**Names.** Sixteen characters of anything, shown to strangers. `BACKLOG.md`'s
small-talk section has already thought about the shape of this — it is worth
reading before building rather than after.

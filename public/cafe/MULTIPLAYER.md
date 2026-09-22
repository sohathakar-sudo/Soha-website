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

> **Built:** `scripts/relay.mjs` is a local one — dependency-free, about eighty
> lines of which are RFC 6455 by hand. It exists so the game's side could be
> written and proved without signing up for anything. Swapping it for a hosted
> pub/sub is a change to `net.js` and nothing else.

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
| Presence built in | nice, but no longer required — the client times peers out itself, which is what makes this portable to a relay that has no opinion about presence |
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

## 3a. Alone is not worth a connection

An empty room costs nothing on its own — nobody is connected, so there is
nothing to pay for, and a hibernating room is the hosting provider's problem
rather than ours.

The case that actually costs money is **one person, by themselves**. They are
connected, publishing, heartbeating, subscribed — and there is no one on the
other end of any of it. That is the most likely state this café will ever be in,
and left alone it is the single largest thing on the bill.

So: **after five minutes alone, go dormant.**

> **Built, and simpler than this sketch expected.** Measured: **zero messages in
> twenty seconds** while dormant, against one or two heartbeats before. Waking
> is instant, and both halves see each other immediately.

- Stop publishing — including the heartbeat, whose entire job is telling other
  people you are still here. Alone, there is nobody to tell
- **Stay connected and stay listening.** The sketch had us unsubscribing and
  polling once a minute; neither is needed. Connections are not what these tiers
  charge for — messages are. Somebody arriving *is* a message, and hearing it is
  what wakes us
- On waking, publish once straight away, so they can see us. A relay that caches
  the last state covers this, but a plain pub/sub will not, and depending on
  which one we are on would be a trap

**What it costs you:** nothing, in the end. The sketch expected to trade away
instant waking for silence and it turned out not to be a trade at all — staying
subscribed costs nothing and wakes on the first word anybody says.

**What it does not change:** anything visible. Dormant still means you are in
the café, walking around, with the jukebox playing. The room does not know and
does not care. Only the talking has stopped.

**One thing it forced, which is worth knowing.** A client that deliberately goes
silent looks exactly like a dead one, so the relay's idle timeout from step 4
would have shown it the door every minute — reconnect, go quiet, be shown out
again, costing far more than the silence saved. Liveness now goes over
protocol-level **pings** rather than application messages. Browsers answer them
without being asked, they cost nothing on anybody's bill, and a hosted pub/sub
does its own keepalive for the same reason.

This pairs with §3 rather than repeating it. Send-on-change makes a *present*
person cheap; going dormant makes an *absent* crowd free. Between them the
common case — Soha alone in her own café at midnight — costs approximately
nothing, which is the correct price for it.

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

> **Built.** The player's own `x`/`y` are eased, not a separate position kept
> for drawing — depth sorting, the bob, footstep counting, facing and the laptop
> all read those, and smoothing only the picture would leave every one of them a
> frame out of step with it.
>
> **Discrete events are not interpolated.** Sitting down snaps you onto a seat,
> and easing towards it looks like being dragged there over half a second. The
> first attempt guessed at this with a distance threshold and let a 50px seat
> snap glide straight through it. A **change of state** is the honest signal, and
> it lands in one frame.

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

1. ~~**Two clients, one room, positions only.**~~ **Done.** `npm run relay`, then
   open the café twice. Two browsers see each other, with names and faces, and
   walking propagates. Send-on-change is in from the start, measured below.
2. ~~**Interpolation.**~~ **Done.** Measured on the watching browser, sampling
   its copy of a walker once per frame: frames where they did not move at all
   went from **88% to 8%**, the biggest single-frame jump from **7px to 2.4px**,
   and the median move is **0.96px** — which is one frame of walking at 60px/s,
   so they move like somebody walking rather than like a message arriving.
3. ~~**Send-on-change.**~~ **Done with step 1**, because it shapes the message
   format and retrofitting it would mean revisiting everything. Measured, out of
   a real browser: **4.6 messages a second while walking, and one in twenty
   seconds while sitting** — that one being the heartbeat. Walking needed a
   ceiling as well as a floor; without `maxMovesPerSecond` it sent on nearly
   every tick, at 15.6/s.
4. ~~**Presence and timeouts.**~~ **Done.** Three ways to go, all measured:
   through the welcome mat (**0.1s**), closing the tab (**0.0s**), and going
   silent without closing anything — a shut laptop — which times out on the
   heartbeat. Reconnection came with it, since a dropped socket that never
   returns is indistinguishable from being alone: the relay was killed
   mid-session, both rooms emptied, and both rejoined when it came back.
5. ~~**Dormancy** (§3a).~~ **Done.** Zero messages while alone, measured over
   twenty seconds. It needed protocol pings in the relay first: a deliberately
   silent client is indistinguishable from a dead one, and step 4's timeout
   would have evicted it on a loop.
6. **The empty room.** See §8.

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

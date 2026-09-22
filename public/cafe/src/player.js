import { PLAYER, COFFEE } from './config.js';

// A Player is plain data: no methods, no DOM, no canvas. It serializes as-is,
// which is what lets the same object come off the wire later.
export function createPlayer({ id, name = 'guest', faceId = 1, x = 0, y = 0 }) {
  return {
    id,
    name,
    faceId,
    x,
    y,
    state: 'walking',     // walking | sitting
    holdingCoffee: false,
    coffees: 0,
    // Seconds left on the cup in their hand. Counted down by applyTime rather
    // than compared against a clock, because the pure steps may not read one.
    coffeeLeft: 0,
    // Whether the jukebox is playing. It lives on the player because that is
    // what travels over the wire, but it is a fact about the room: a café has
    // one jukebox, and switching it off switches it off for whoever is in
    // there with you. See the open question in CONTEXT.md.
    music: true,
    // Set for one tick when they ask to leave, and cleared by whoever acts on
    // it. A flag rather than a call, because applyInteraction is pure and has
    // no business tearing down a room.
    leaving: false,
  };
}

// The collision box is a small rectangle around the ground point.
export function footBox(x, y) {
  const { w, h } = PLAYER.hitbox;
  return { x: x - w / 2, y: y - h, w, h };
}

// Pure: takes state in, returns state out, touches nothing else. The same call
// has to run on a server later, so it must not read the clock, the DOM, or any
// module-level mutable state, and nothing in the draw path may be called from it.
//
//   player    the mover; not mutated
//   input     { left, right, up, down }
//   dt        seconds
//   collision optional { hits(box) -> boolean }; omitted means open floor
export function applyMovement(player, input, dt, collision) {
  let vx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let vy = (input.down ? 1 : 0) - (input.up ? 1 : 0);

  if (vx === 0 && vy === 0) {
    return { x: player.x, y: player.y };
  }

  // Normalise, so moving diagonally is not faster than moving straight.
  if (vx !== 0 && vy !== 0) {
    const inv = 1 / Math.SQRT2;
    vx *= inv;
    vy *= inv;
  }

  const step = PLAYER.speed * dt;
  let x = player.x;
  let y = player.y;

  // Resolve one axis at a time, so a blocked diagonal slides along the wall
  // instead of stopping dead against it.
  if (vx !== 0) {
    const nx = x + vx * step;
    if (!collision || !collision.hits(footBox(nx, y))) x = nx;
  }
  if (vy !== 0) {
    const ny = y + vy * step;
    if (!collision || !collision.hits(footBox(x, ny))) y = ny;
  }

  return { x, y };
}

// Seating zones hold a list of seats; you get the nearest one nobody is on.
const SEATING = ['table', 'bar'];

function nearestFreeSeat(zone, x, y, taken) {
  let best = null;
  let bestDistance = Infinity;

  for (const seat of zone.seats || []) {
    if (taken.some((t) => t.x === seat.x && t.y === seat.y)) continue;
    const distance = (seat.x - x) ** 2 + (seat.y - y) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = seat;
    }
  }

  return best;
}

// Pure, like applyMovement: state in, state out. Returns the fields the
// interaction touches, so the caller can assign them onto the player.
//
// Transitions:
//   walking + Enter in a table or bar zone -> sitting at the nearest free seat
//                                             (nothing happens if it is full)
//   sitting + any movement                 -> walking, released from the seat
//   walking + Enter in a counter zone      -> a coffee, good for COFFEE.lasts
//   walking + Enter in the jukebox zone    -> the music stops, or starts again
//   walking + Enter on the welcome mat     -> asks to leave; the caller acts
//
// input.interact is already edge-triggered by the time it arrives here.
// `taken` is the list of seat positions other players are already on.
export function applyInteraction(player, input, room, taken = []) {
  let { state, x, y, holdingCoffee, coffees, music, coffeeLeft } = player;
  let leaving = false;

  const moving = input.left || input.right || input.up || input.down;

  // Standing up beats everything else: movement is never ignored.
  if (state === 'sitting' && moving) {
    state = 'walking';
  } else if (input.interact && state !== 'sitting' && room) {
    const zone = room.zoneAt(x, y);

    if (zone && SEATING.includes(zone.type)) {
      const seat = nearestFreeSeat(zone, x, y, taken);
      if (seat) {
        state = 'sitting';
        x = seat.x;
        y = seat.y;
      }
    } else if (zone && zone.type === 'counter') {
      // A fresh cup restarts the clock, whatever was left of the last one.
      holdingCoffee = true;
      coffeeLeft = COFFEE.lasts;
      coffees += 1;
    } else if (zone && zone.type === 'jukebox') {
      music = !music;
    } else if (zone && zone.type === 'door') {
      leaving = true;
    }
  }

  return { state, x, y, holdingCoffee, coffees, music, coffeeLeft, leaving };
}

export function isSeated(player) {
  return player.state === 'sitting';
}

// Whether somebody is working, which today means nothing more than being sat
// down. There is no `working` state and there is deliberately not going to be
// one — it was removed along with seat facing and the laptop square, and this
// is a question asked about the two states that exist, not a third.
//
// It is also the hook the café's focus time will hang on. When the menu lands
// this becomes `isSeated(player) && sessionRunning(player)`, and every desk
// sound stops when the timer does, because they all already ask right here.
export function isWorking(player) {
  return isSeated(player);
}

// The third pure step, beside applyMovement and applyInteraction: state and a
// duration in, state out, no clock and no DOM. A server has to be able to run
// it, which is exactly why the coffee is a countdown rather than a timestamp.
export function applyTime(player, dt) {
  if (player.coffeeLeft <= 0) return { coffeeLeft: 0, holdingCoffee: false };

  const coffeeLeft = Math.max(0, player.coffeeLeft - dt);
  return { coffeeLeft, holdingCoffee: coffeeLeft > 0 };
}

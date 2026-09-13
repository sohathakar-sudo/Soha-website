import { PLAYER } from './config.js';

// A Player is plain data: no methods, no DOM, no canvas. It serializes as-is,
// which is what lets the same object come off the wire later.
export function createPlayer({ id, name = 'guest', catId = 'cat-01', x = 0, y = 0 }) {
  return {
    id,
    name,
    catId,
    x,
    y,
    state: 'walking',     // walking | sitting
    holdingCoffee: false,
    coffees: 0,
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

// Pure, like applyMovement: state in, state out. Returns the fields the
// interaction touches, so the caller can assign them onto the player.
//
// Transitions:
//   walking + Enter in a table zone   -> sitting, snapped to the seat
//   sitting + any movement            -> walking, released from the seat
//   walking + Enter in a counter zone -> a coffee
//
// input.interact is already edge-triggered by the time it arrives here.
export function applyInteraction(player, input, room) {
  let { state, x, y, holdingCoffee, coffees } = player;

  const moving = input.left || input.right || input.up || input.down;

  // Standing up beats everything else: movement is never ignored.
  if (state === 'sitting' && moving) {
    state = 'walking';
  } else if (input.interact && state !== 'sitting' && room) {
    const zone = room.zoneAt(x, y);
    if (zone && zone.type === 'table' && zone.seat) {
      state = 'sitting';
      x = zone.seat.x;
      y = zone.seat.y;
    } else if (zone && zone.type === 'counter') {
      holdingCoffee = true;
      coffees += 1;
    }
  }

  return { state, x, y, holdingCoffee, coffees };
}

export function isSeated(player) {
  return player.state === 'sitting';
}

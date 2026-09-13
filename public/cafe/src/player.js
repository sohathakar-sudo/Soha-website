import { PLAYER } from './config.js';

// A Player is plain data: no methods, no DOM, no canvas. It serializes as-is,
// which is what lets the same object come off the wire later.
export function createPlayer({ id, name = 'guest', catId = 'cat-01', x = 0, y = 0, dir = 'down' }) {
  return {
    id,
    name,
    catId,
    x,
    y,
    dir,
    state: 'idle',        // idle | walking | sitting | working
    holdingCoffee: false,
    coffees: 0,
  };
}

// The player's collision box is a small rectangle at the feet, not the whole
// 32x32 sprite. (x, y) is the point the feet stand on.
export function footBox(x, y) {
  const { w, h } = PLAYER.hitbox;
  return { x: x - w / 2, y: y - h, w, h };
}

// Pure: takes state in, returns state out, touches nothing else. The same call
// has to run on a server later, so it must not read the clock, the DOM, or any
// module-level mutable state.
//
//   player    the mover; not mutated
//   input     { left, right, up, down }
//   dt        seconds
//   collision optional { hits(box) -> boolean }; omitted means open floor
export function applyMovement(player, input, dt, collision) {
  let vx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let vy = (input.down ? 1 : 0) - (input.up ? 1 : 0);

  if (vx === 0 && vy === 0) {
    return { x: player.x, y: player.y, dir: player.dir };
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

  // Facing comes from the dominant axis and is kept when input stops. A perfect
  // diagonal resolves to left/right, which reads better than flipping to the
  // vertical frames mid-stride.
  const dir = Math.abs(vx) >= Math.abs(vy)
    ? (vx > 0 ? 'right' : 'left')
    : (vy > 0 ? 'down' : 'up');

  return { x, y, dir };
}

// Pure, like applyMovement: state in, state out. Returns the fields the
// interaction touches, so the caller can assign them onto the player.
//
// Transitions:
//   idle/walking + Enter in a table zone   -> sitting, snapped to the seat
//   sitting      + Enter                   -> working
//   working      + Enter                   -> sitting
//   sitting/working + any movement         -> idle, released from the seat
//   idle/walking + Enter in a counter zone -> a coffee
//
// input.interact is already edge-triggered by the time it arrives here.
export function applyInteraction(player, input, room) {
  let { state, x, y, dir, holdingCoffee, coffees } = player;

  const moving = input.left || input.right || input.up || input.down;
  const seated = state === 'sitting' || state === 'working';

  // Standing up beats everything else: movement is never ignored.
  if (seated && moving) {
    state = 'idle';
  } else if (input.interact) {
    if (state === 'sitting') {
      state = 'working';
    } else if (state === 'working') {
      state = 'sitting';
    } else if (room) {
      const zone = room.zoneAt(x, y);
      if (zone && zone.type === 'table' && zone.seat) {
        state = 'sitting';
        x = zone.seat.x;
        y = zone.seat.y;
        dir = zone.facing || dir;
      } else if (zone && zone.type === 'counter') {
        holdingCoffee = true;
        coffees += 1;
      }
    }
  }

  return { state, x, y, dir, holdingCoffee, coffees };
}

export function isSeated(player) {
  return player.state === 'sitting' || player.state === 'working';
}

// Is the room actually walkable?
//
// Written after the garden spent two commits sealed off. It looked perfect in
// every screenshot: the art was right, the collision lined up with the art, and
// there was simply no way to get there. Nothing that checks alignment can catch
// that, because every individual rectangle was correct — it was the gaps
// between them that were gone.
//
//   npm run check-room
//
// Run it after anything that touches solids.

import { readFileSync } from 'node:fs';

const room = JSON.parse(readFileSync(new URL('../public/cafe/data/room.json', import.meta.url)));
const HITBOX = { w: 16, h: 8 };   // must match PLAYER.hitbox in src/config.js
const STEP = 2;

function blocked(x, y) {
  const bx = x - HITBOX.w / 2, by = y - HITBOX.h;
  return room.solids.some((s) =>
    bx < s.x + s.w && bx + HITBOX.w > s.x && by < s.y + s.h && by + HITBOX.h > s.y);
}

const key = (x, y) => `${x},${y}`;
const seen = new Set([key(room.spawn.x, room.spawn.y)]);
const queue = [[room.spawn.x, room.spawn.y]];

while (queue.length) {
  const [x, y] = queue.pop();
  for (const [dx, dy] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) {
    const nx = x + dx, ny = y + dy;
    if (nx <= 0 || ny <= 0 || nx >= 640 || ny >= 360) continue;
    if (seen.has(key(nx, ny)) || blocked(nx, ny)) continue;
    seen.add(key(nx, ny));
    queue.push([nx, ny]);
  }
}

const reachable = (x, y) => {
  for (let ox = -STEP; ox <= STEP; ox++) {
    for (let oy = -STEP; oy <= STEP; oy++) if (seen.has(key(x + ox, y + oy))) return true;
  }
  return false;
};

let bad = 0;
console.log(`walkable from the spawn: ${seen.size} points\n`);

// Every seat has to be somewhere a person can actually get to.
for (const zone of room.zones) {
  for (const seat of zone.seats || []) {
    if (!reachable(seat.x, seat.y)) {
      console.log(`  UNREACHABLE  ${zone.type} seat at ${seat.x},${seat.y}`);
      bad++;
    }
  }
}

// And so does every place you can interact with.
for (const zone of room.zones) {
  const cx = Math.round(zone.x + zone.w / 2), cy = Math.round(zone.y + zone.h / 2);
  if (!(zone.seats || []).length && !reachable(cx, cy)) {
    console.log(`  UNREACHABLE  ${zone.type} zone around ${cx},${cy}`);
    bad++;
  }
}

if (bad) {
  console.log(`\n${bad} unreachable. Somewhere in the room is walled off.`);
  process.exit(1);
}
console.log('every seat and every zone can be walked to.');

import { PATHS } from './config.js';

// Room geometry and the queries the game asks of it. No DOM, no canvas: the
// same object can be built from the same JSON on a server.
export function createRoom(data) {
  const solids = data.solids || [];
  const zones = data.zones || [];
  const spawn = data.spawn || { x: 0, y: 0 };

  return {
    solids,
    zones,
    spawn,

    // True if an axis-aligned box overlaps any solid. This is the probe
    // applyMovement calls, once per axis.
    hits(box) {
      for (const s of solids) {
        if (
          box.x < s.x + s.w &&
          box.x + box.w > s.x &&
          box.y < s.y + s.h &&
          box.y + box.h > s.y
        ) return true;
      }
      return false;
    },

    // The zone a point stands in, optionally of one type. Later zones win, so a
    // zone drawn on top of another in the editor is the one you interact with.
    zoneAt(x, y, type) {
      let found = null;
      for (const z of zones) {
        if (type && z.type !== type) continue;
        if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) found = z;
      }
      return found;
    },

    // For the debug editor and for serialising edits back out.
    toJSON() {
      return { solids, zones, spawn };
    },
  };
}

export async function loadRoom(url = PATHS.room) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load ${url}: HTTP ${res.status}`);
  return createRoom(await res.json());
}

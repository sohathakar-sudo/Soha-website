// The roster tab on the left: who is in the café right now, each with their
// floating head beside their name.
//
// Pure DOM, laid over the canvas. It is not part of the room and never travels
// over the wire — it only reads the same `players` map main.js draws from, so
// the local player and everyone who arrived over the relay appear through one
// path, exactly as they do in the room.
//
// The heads are the very face PNGs the game draws, bobbing with a little CSS
// float so they read as the floating heads they are in the room rather than as
// flat avatars. Nothing here simulates anything: it reconciles a list against a
// map, and the map is always current by the time it looks.

import { PATHS, ROSTER, faceFile } from './config.js';

const OPEN_KEY = 'cafe:roster-open';

function readOpen() {
  try {
    // Default open: a quiet room is easier to walk into when you can see who is
    // already in it.
    return localStorage.getItem(OPEN_KEY) !== 'false';
  } catch {
    return true;
  }
}

function writeOpen(open) {
  try {
    localStorage.setItem(OPEN_KEY, String(open));
  } catch {
    /* storage unavailable; the choice still holds for this session */
  }
}

// A stable per-player wobble so the heads do not all bob in lockstep. Derived
// from the id rather than stored, so a player arriving over the wire gets one
// for free and keeps it as long as they stay.
function hash(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

// Local first — you are the one point of reference in the room — then everyone
// else by name, with the id as a tiebreaker so the order never flickers
// between two people sharing a name.
function order(localId) {
  return (a, b) => {
    if (a.id === localId) return -1;
    if (b.id === localId) return 1;
    const byName = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    return byName !== 0 ? byName : (a.id < b.id ? -1 : 1);
  };
}

export function createRoster({ players, localId }) {
  const panel = document.getElementById('roster');
  const list = document.getElementById('roster-list');
  const count = document.getElementById('roster-count');
  const tab = document.getElementById('roster-tab');

  let open = readOpen();
  apply();

  tab.addEventListener('click', () => {
    open = !open;
    apply();
    writeOpen(open);
  });

  function apply() {
    panel.dataset.open = String(open);
    tab.setAttribute('aria-expanded', String(open));
  }

  // One row per player, kept across updates so the float animation runs
  // uninterrupted and the images are not re-fetched each time the list is
  // reconciled. Keyed by id; name and face are written only when they change.
  const rows = new Map();
  let lastOrder = '';

  function makeRow(player) {
    const li = document.createElement('li');

    const head = document.createElement('span');
    head.className = 'roster-head';
    const h = hash(player.id);
    // 2.4–3.3s per bob, started somewhere mid-cycle, so no two heads rise
    // together.
    head.style.setProperty('--float-dur', (2.4 + (h % 90) / 100).toFixed(2) + 's');
    head.style.setProperty('--float-delay', '-' + ((h % 260) / 100).toFixed(2) + 's');

    const img = document.createElement('img');
    img.alt = '';
    img.width = 34;
    img.height = 34;
    head.appendChild(img);

    const name = document.createElement('span');
    name.className = 'roster-name';

    li.appendChild(head);
    li.appendChild(name);

    return { li, img, nameEl: name, faceSrc: '', label: '' };
  }

  function update() {
    const ordered = [...players.values()].sort(order(localId));
    const seen = new Set();
    let sequence = '';

    for (const player of ordered) {
      seen.add(player.id);
      sequence += player.id + ';';

      let row = rows.get(player.id);
      if (!row) {
        row = makeRow(player);
        rows.set(player.id, row);
      }

      const faceSrc = PATHS.assets + faceFile(player.faceId);
      if (row.faceSrc !== faceSrc) {
        row.img.src = faceSrc;
        row.faceSrc = faceSrc;
      }

      const label = player.id === localId ? player.name + ' (you)' : player.name;
      if (row.label !== label) {
        row.nameEl.textContent = label;
        row.label = label;
      }
    }

    // Anyone who walked out since the last pass.
    for (const [id, row] of rows) {
      if (!seen.has(id)) {
        row.li.remove();
        rows.delete(id);
      }
    }

    // Only touch the DOM order when it actually changed: moving nodes every
    // frame is both wasteful and enough to hitch the float animation.
    if (sequence !== lastOrder) {
      for (const player of ordered) list.appendChild(rows.get(player.id).li);
      lastOrder = sequence;
    }

    count.textContent = String(ordered.length);
    panel.dataset.empty = String(ordered.length === 0);
  }

  return { update };
}

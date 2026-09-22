import { VIEW } from './config.js';
import { play } from './sounds.js';

const MIN_SIZE = 4;
const HANDLE = 5; // corner grab area, in native pixels

// What the number keys place.
const PLACING = {
  Digit1: { kind: 'solid' },
  Digit2: { kind: 'zone', type: 'table' },
  Digit3: { kind: 'zone', type: 'counter' },
  Digit4: { kind: 'zone', type: 'bar' },
  Digit5: { kind: 'zone', type: 'jukebox' },
};

// Zone types that hold seats.
const SEATING = ['table', 'bar'];
const SEAT_GRAB = 4; // click within this many pixels to remove a seat

const COLORS = {
  solidFill: 'rgba(255, 64, 64, 0.22)',
  solidLine: 'rgba(255, 96, 96, 0.85)',
  zoneFill: 'rgba(64, 132, 255, 0.22)',
  zoneLine: 'rgba(108, 164, 255, 0.85)',
  selected: '#ffffff',
  seat: '#ffd479',
  text: '#f2f2f4',
  shadow: '#15151a',
};

function normalize(rect) {
  return {
    x: Math.round(Math.min(rect.x, rect.x + rect.w)),
    y: Math.round(Math.min(rect.y, rect.y + rect.h)),
    w: Math.round(Math.abs(rect.w)),
    h: Math.round(Math.abs(rect.h)),
  };
}

function contains(rect, x, y) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function onHandle(rect, x, y) {
  return Math.abs(x - (rect.x + rect.w)) <= HANDLE && Math.abs(y - (rect.y + rect.h)) <= HANDLE;
}

// The editor owns its own listeners and its own state. The game neither knows
// nor cares that it exists; it only calls toggle() and draw().
export function createDebugEditor({ canvas, room, loop, players, localId, reloadArt }) {
  const bar = document.getElementById('debug-bar');
  const copyButton = document.getElementById('debug-copy');
  const copyNote = document.getElementById('debug-note');

  let active = false;
  let placing = PLACING.Digit1;
  let selected = null;       // { list, item }
  let drag = null;           // { mode, startX, startY, origin }

  function toNative(event) {
    const box = canvas.getBoundingClientRect();
    const scaleX = box.width / VIEW.width;
    const scaleY = box.height / VIEW.height;
    return {
      x: Math.round((event.clientX - box.left) / scaleX),
      y: Math.round((event.clientY - box.top) / scaleY),
    };
  }

  // Zones sit above solids for hit-testing: they are what you usually reach for,
  // and a zone almost always overlaps the solid it belongs to.
  function pick(x, y) {
    for (let i = room.zones.length - 1; i >= 0; i--) {
      if (contains(room.zones[i], x, y)) return { list: room.zones, item: room.zones[i] };
    }
    for (let i = room.solids.length - 1; i >= 0; i--) {
      if (contains(room.solids[i], x, y)) return { list: room.solids, item: room.solids[i] };
    }
    return null;
  }

  function onPointerDown(event) {
    if (!active) return;
    event.preventDefault();
    const { x, y } = toNative(event);

    // Shift-click adds a seat to the selected zone, or removes one you hit.
    if (event.shiftKey && selected && SEATING.includes(selected.item.type)) {
      const seats = selected.item.seats || (selected.item.seats = []);
      const hitIndex = seats.findIndex((s) => Math.abs(s.x - x) <= SEAT_GRAB && Math.abs(s.y - y) <= SEAT_GRAB);
      if (hitIndex >= 0) seats.splice(hitIndex, 1);
      else seats.push({ x, y });
      return;
    }

    if (selected && onHandle(selected.item, x, y)) {
      drag = { mode: 'resize', item: selected.item };
      return;
    }

    const hit = pick(x, y);
    if (hit) {
      selected = hit;
      drag = {
        mode: 'move',
        item: hit.item,
        offsetX: x - hit.item.x,
        offsetY: y - hit.item.y,
      };
      return;
    }

    // Empty space: start a new rect of whatever the number keys last chose.
    const item = placing.kind === 'solid'
      ? { x, y, w: 0, h: 0 }
      : { type: placing.type, x, y, w: 0, h: 0 };
    if (SEATING.includes(placing.type)) item.seats = [];
    const list = placing.kind === 'solid' ? room.solids : room.zones;
    list.push(item);
    selected = { list, item };
    drag = { mode: 'create', item, anchorX: x, anchorY: y };
  }

  function onPointerMove(event) {
    if (!active || !drag) return;
    const { x, y } = toNative(event);
    const item = drag.item;

    if (drag.mode === 'move') {
      item.x = x - drag.offsetX;
      item.y = y - drag.offsetY;
    } else if (drag.mode === 'resize') {
      item.w = Math.max(MIN_SIZE, x - item.x);
      item.h = Math.max(MIN_SIZE, y - item.y);
    } else if (drag.mode === 'create') {
      Object.assign(item, normalize({ x: drag.anchorX, y: drag.anchorY, w: x - drag.anchorX, h: y - drag.anchorY }));
    }
  }

  function onPointerUp() {
    if (!active || !drag) return;
    const item = drag.item;

    // A click that never became a drag should not leave a sliver behind.
    if (drag.mode === 'create' && (item.w < MIN_SIZE || item.h < MIN_SIZE)) {
      remove({ list: selected.list, item });
    } else {
      Object.assign(item, normalize(item));
    }
    drag = null;
  }

  function remove(target) {
    const index = target.list.indexOf(target.item);
    if (index >= 0) target.list.splice(index, 1);
    if (selected && selected.item === target.item) selected = null;
  }

  function onKeyDown(event) {
    if (!active) return;

    if (PLACING[event.code]) {
      placing = PLACING[event.code];
      event.preventDefault();
      return;
    }

    if (event.code === 'Delete' || event.code === 'Backspace') {
      if (selected) remove(selected);
      event.preventDefault();
      return;
    }

    // Reload the room art without losing where anyone is standing.
    if (event.code === 'KeyR') {
      if (reloadArt) reloadArt().then(() => note('Room art reloaded')).catch(() => note('Room art failed to reload'));
      event.preventDefault();
    }

  }

  async function copyJson() {
    const json = JSON.stringify(room.toJSON(), null, 2);
    try {
      await navigator.clipboard.writeText(json);
      note('Copied — paste it into data/room.json');
    } catch {
      // Clipboard permission can be refused; the JSON still has to be reachable.
      const box = document.createElement('textarea');
      box.value = json;
      document.body.appendChild(box);
      box.select();
      const ok = document.execCommand && document.execCommand('copy');
      box.remove();
      note(ok ? 'Copied — paste it into data/room.json' : 'Copy blocked — see the console');
      if (!ok) console.log(json);
    }
  }

  let noteTimer = 0;
  function note(text) {
    copyNote.textContent = text;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { copyNote.textContent = ''; }, 4000);
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('keydown', onKeyDown);
  copyButton.addEventListener('click', () => {
    play('click');
    copyJson();
  });

  function drawRect(ctx, rect, fill, line) {
    ctx.fillStyle = fill;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
  }

  function label(ctx, text, x, y, align = 'left') {
    ctx.textAlign = align;
    ctx.fillStyle = COLORS.shadow;
    ctx.fillText(text, x + 1, y + 1);
    ctx.fillStyle = COLORS.text;
    ctx.fillText(text, x, y);
    ctx.textAlign = 'left';
  }

  return {
    get active() { return active; },

    toggle() {
      active = !active;
      bar.hidden = !active;
      canvas.style.cursor = active ? 'crosshair' : '';
      if (!active) {
        selected = null;
        drag = null;
      }
    },

    draw(ctx) {
      if (!active) return;

      ctx.font = '8px monospace';
      ctx.textBaseline = 'top';

      for (const solid of room.solids) drawRect(ctx, solid, COLORS.solidFill, COLORS.solidLine);

      for (const zone of room.zones) {
        drawRect(ctx, zone, COLORS.zoneFill, COLORS.zoneLine);
        ctx.fillStyle = COLORS.seat;
        for (const seat of zone.seats || []) ctx.fillRect(seat.x - 1, seat.y - 1, 3, 3);
      }

      if (selected) {
        const r = selected.item;
        ctx.strokeStyle = COLORS.selected;
        ctx.lineWidth = 1;
        ctx.strokeRect(r.x - 0.5, r.y - 0.5, r.w + 1, r.h + 1);
        ctx.fillStyle = COLORS.selected;
        ctx.fillRect(r.x + r.w - 2, r.y + r.h - 2, 4, 4); // resize handle
      }

      const me = players.get(localId);
      label(ctx, `fps ${loop.stats.fps}  ${Math.round(me.x)},${Math.round(me.y)}  ${me.state}`, 4, 4);

      const what = placing.kind === 'solid' ? 'solid' : placing.type + ' zone';
      const seats = selected && selected.item.seats ? `  ${selected.item.seats.length} seats` : '';
      label(ctx, `placing ${what}${seats}`, VIEW.width - 4, 4, 'right');
      label(ctx, '1 solid 2 table 3 counter 4 bar 5 jukebox · shift-click seat · R reload art · del remove',
        VIEW.width / 2, VIEW.height - 10, 'center');
    },
  };
}

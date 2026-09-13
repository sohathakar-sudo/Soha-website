import { VIEW, DIRECTIONS } from './config.js';

const MIN_SIZE = 4;
const HANDLE = 5; // corner grab area, in native pixels

// What the number keys place.
const PLACING = {
  Digit1: { kind: 'solid' },
  Digit2: { kind: 'zone', type: 'table' },
  Digit3: { kind: 'zone', type: 'counter' },
};

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
export function createDebugEditor({ canvas, room, loop, players, localId }) {
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

    // Shift-click plants the seat of the selected table zone.
    if (event.shiftKey && selected && selected.item.type === 'table') {
      selected.item.seat = { x, y };
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
    if (placing.type === 'table') {
      item.seat = { x, y };
      item.facing = 'up';
    }
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

    // [ and ] cycle the facing of the selected table zone.
    if ((event.code === 'BracketLeft' || event.code === 'BracketRight') && selected && selected.item.type === 'table') {
      const current = DIRECTIONS.indexOf(selected.item.facing);
      const step = event.code === 'BracketRight' ? 1 : -1;
      const next = (current + step + DIRECTIONS.length) % DIRECTIONS.length;
      selected.item.facing = DIRECTIONS[next];
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
  copyButton.addEventListener('click', copyJson);

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
        if (!zone.seat) continue;

        // Seat position, with a stub pointing the way the seat faces.
        const { x, y } = zone.seat;
        ctx.fillStyle = COLORS.seat;
        ctx.fillRect(x - 1, y - 1, 3, 3);
        const reach = { down: [0, 5], up: [0, -5], left: [-5, 0], right: [5, 0] }[zone.facing] || [0, 0];
        ctx.fillRect(x + Math.min(0, reach[0]), y + Math.min(0, reach[1]), Math.abs(reach[0]) || 1, Math.abs(reach[1]) || 1);
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
      const facing = selected && selected.item.type === 'table' ? `  facing ${selected.item.facing}` : '';
      label(ctx, `placing ${what}${facing}`, VIEW.width - 4, 4, 'right');
      label(ctx, '1 solid  2 table  3 counter  shift-click seat  [ ] facing  del remove', VIEW.width / 2, VIEW.height - 10, 'center');
    },
  };
}

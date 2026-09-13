import { VIEW, PATHS } from './config.js';
import { createLoop } from './loop.js';
import { attachInput, readInput, hasMovement, consumePress } from './input.js';
import { createPlayer, applyMovement, applyInteraction, isSeated } from './player.js';
import { loadCatSheet, loadImage, createRenderState, advanceAnimation } from './sprites.js';
import { drawBackground, drawForeground, drawPlayers } from './render.js';
import { loadRoom } from './room.js';
import { showTitle, drawHud } from './ui.js';
import { createDebugEditor } from './debug.js';
import * as net from './net.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

canvas.width = VIEW.width;
canvas.height = VIEW.height;

// --- Integer scaling -------------------------------------------------------
// The backing store stays at native resolution. Only the CSS size changes, so
// every pixel is upscaled by a whole number and nothing ever blurs.
// Scale against the element the canvas sits in, not the window, so the game also
// behaves when it is embedded in a page that has other content around it.
const stage = canvas.parentElement;
let scale = 1;

function resize() {
  const availW = stage.clientWidth || window.innerWidth;
  const availH = stage.clientHeight || window.innerHeight;
  const fitX = Math.floor(availW / VIEW.width);
  const fitY = Math.floor(availH / VIEW.height);
  scale = Math.max(1, Math.min(fitX, fitY, VIEW.maxScale));
  canvas.style.width = `${VIEW.width * scale}px`;
  canvas.style.height = `${VIEW.height * scale}px`;
  ctx.imageSmoothingEnabled = false;
}

window.addEventListener('resize', resize);
resize();

// --- Room state ------------------------------------------------------------
// Every player lives here, the local one included. Nothing downstream may treat
// 'local' differently except input handling and the view (HUD, and a camera when
// there is one).
const LOCAL_ID = 'local';
const players = new Map();

// Render state is deliberately a separate map: animation timers are not part of
// the room and never travel over the wire.
const renderStates = new Map();

const sheets = new Map();

function removePlayer(id) {
  players.delete(id);
  renderStates.delete(id);
}

// Any player can arrive wearing a cat nobody has loaded yet, and a player can
// change cats between snapshots, so this runs on every update rather than only
// when someone joins.
function ensureSheet(catId) {
  if (sheets.has(catId)) return;
  sheets.set(catId, null); // claim it, so a slow load is not started twice
  loadCatSheet(catId)
    .then((img) => sheets.set(catId, img))
    .catch((err) => {
      sheets.delete(catId);
      console.error(err);
    });
}

function addPlayer(player) {
  players.set(player.id, player);
  renderStates.set(player.id, createRenderState());
  ensureSheet(player.catId);
  return player;
}

const ZERO_INPUT = { left: false, right: false, up: false, down: false, interact: false };

// --- Persistence -----------------------------------------------------------
// Only the local player's own coffee count. Private browsing can make storage
// throw, and a broken café is worse than a forgotten coffee count.
const COFFEE_KEY = 'cafe:coffees';
let savedCoffees = -1;

function readCoffees() {
  try {
    return Number(localStorage.getItem(COFFEE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function rememberCoffees(count) {
  if (count === savedCoffees) return;
  savedCoffees = count;
  try {
    localStorage.setItem(COFFEE_KEY, String(count));
  } catch {
    /* storage unavailable; the count still works for this session */
  }
}

// The only place the local player is special: it reads the keyboard. Remote
// players will get their input from snapshots through the same path.
function inputFor(player, localInput) {
  return player.id === LOCAL_ID ? localInput : ZERO_INPUT;
}

// One player, one tick. Identical for everyone in the map: whether the input
// came from this keyboard or from a snapshot makes no difference here.
function stepPlayer(player, input, dt) {
  // Interactions first: they can stand a seated player up in time for the
  // same tick's movement.
  Object.assign(player, applyInteraction(player, input, room));

  if (!isSeated(player)) {
    const moved = applyMovement(player, input, dt, room);
    player.x = moved.x;
    player.y = moved.y;
    player.dir = moved.dir;
    player.state = hasMovement(input) ? 'walking' : 'idle';
  }

  advanceAnimation(renderStates.get(player.id), player.state, player.dir, dt);
}

// --- Loop ------------------------------------------------------------------
let tick = 0;

function update(dt) {
  tick++;

  if (consumePress('Backquote') && editor) editor.toggle();

  // Reading this keyboard and sending it upstream are local concerns, so they
  // happen here rather than inside the loop that treats every player alike.
  const localInput = readInput();
  net.sendInput(localInput, tick);

  for (const player of players.values()) {
    stepPlayer(player, inputFor(player, localInput), dt);
  }

  rememberCoffees(players.get(LOCAL_ID).coffees);
}

// What Enter would do from where the player is standing.
function promptFor(player) {
  if (isSeated(player)) {
    return player.state === 'sitting' ? 'ENTER  work' : 'ENTER  stop working';
  }
  const zone = room ? room.zoneAt(player.x, player.y) : null;
  if (!zone) return '';
  return zone.type === 'counter' ? 'ENTER  coffee' : 'ENTER  sit';
}

function render() {
  ctx.imageSmoothingEnabled = false;
  drawBackground(ctx, art.bg);
  drawPlayers(ctx, players, renderStates, sheets);
  drawForeground(ctx, art.fg);

  const me = players.get(LOCAL_ID);
  // The editor replaces the HUD rather than crowding it: both want the same
  // corners.
  if (editor && editor.active) {
    editor.draw(ctx);
  } else {
    drawHud(ctx, me, promptFor(me));
  }
}

// Multiplayer hook. Nothing sends snapshots yet, but this is the shape one takes:
// upsert everyone the server knows about, drop everyone it no longer does.
// Reconciling the local player's own predicted position is the piece phase two
// will have to add.
net.onSnapshot((snapshot) => {
  const seen = new Set();

  for (const incoming of snapshot.players || []) {
    seen.add(incoming.id);
    const existing = players.get(incoming.id);
    if (existing) {
      Object.assign(existing, incoming);
      ensureSheet(existing.catId);
    } else {
      addPlayer(createPlayer(incoming));
    }
  }

  for (const id of [...players.keys()]) {
    if (!seen.has(id)) removePlayer(id);
  }
});

const loop = createLoop({ update, render });

// --- Boot ------------------------------------------------------------------
let room = null;
let editor = null;
const art = { bg: null, fg: null };

async function boot() {
  const [loadedRoom, bg, fg] = await Promise.all([
    loadRoom(),
    loadImage(PATHS.assets + 'room-bg.png').catch(() => null),
    loadImage(PATHS.assets + 'room-fg.png').catch(() => null),
  ]);

  room = loadedRoom;
  art.bg = bg;
  art.fg = fg;

  // The title screen blocks here until the player picks a name and a cat.
  const choice = await showTitle();

  const me = createPlayer({
    id: LOCAL_ID,
    name: choice.name,
    catId: choice.catId,
    x: room.spawn.x,
    y: room.spawn.y,
  });
  me.coffees = readCoffees();
  me.holdingCoffee = me.coffees > 0;
  savedCoffees = me.coffees;
  addPlayer(me);

  attachInput();
  editor = createDebugEditor({ canvas, room, loop, players, localId: LOCAL_ID });
  net.connect();
  loop.start();

  // A handle for the console and for the debug editor in phase 7. Read-only in
  // spirit: the game never reads anything back off it.
  window.cafe = { players, renderStates, room, art, loop, editor };
}

boot().catch((err) => {
  console.error(err);
  ctx.fillStyle = '#1a1a1e';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = '#e8e8ec';
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  ctx.fillText('Could not start: ' + err.message, 8, 8);
  ctx.fillText('The game needs a server — see cafe/README.md', 8, 20);
});

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
// 'local' differently except input handling and the camera.
const players = new Map();

// Render state is deliberately a separate map: animation timers are not part of
// the room and never travel over the wire.
const renderStates = new Map();

const sheets = new Map();

function addPlayer(player) {
  players.set(player.id, player);
  renderStates.set(player.id, createRenderState());
  loadCatSheet(player.catId)
    .then((img) => sheets.set(player.catId, img))
    .catch((err) => console.error(err));
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
function inputFor(player) {
  return player.id === 'local' ? readInput() : ZERO_INPUT;
}

// --- Loop ------------------------------------------------------------------
let tick = 0;

function update(dt) {
  tick++;

  if (consumePress('Backquote') && editor) editor.toggle();

  for (const player of players.values()) {
    const input = inputFor(player);

    if (player.id === 'local') net.sendInput(input, tick);

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

    if (player.id === 'local') rememberCoffees(player.coffees);

    advanceAnimation(renderStates.get(player.id), player.state, player.dir, dt);
  }
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

  const me = players.get('local');
  // The editor replaces the HUD rather than crowding it: both want the same
  // corners.
  if (editor && editor.active) {
    editor.draw(ctx);
  } else {
    drawHud(ctx, me, promptFor(me));
  }
}

// Multiplayer hook: snapshots would be applied to room state here.
net.onSnapshot(() => {});

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
    id: 'local',
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
  editor = createDebugEditor({ canvas, room, loop, players });
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

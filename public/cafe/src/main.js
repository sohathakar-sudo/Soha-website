import { VIEW, PATHS, AUDIO } from './config.js';
import { createLoop } from './loop.js';
import { attachInput, readInput, consumePress } from './input.js';
import { createPlayer, applyMovement, applyInteraction, isSeated } from './player.js';
import { loadFaces, loadImage, createRenderState, advanceBob } from './faces.js';
import { drawBackground, drawForeground, drawPlayers } from './render.js';
import { loadRoom } from './room.js';
import { showTitle, drawHud } from './ui.js';
import { createDebugEditor } from './debug.js';
import * as audio from './audio.js';
import { gainFor } from './audio.js';
import { play } from './sounds.js';
import * as ambience from './ambience.js';
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

// Faces are loaded once at boot and indexed by faceId, never per player.

function removePlayer(id) {
  players.delete(id);
  renderStates.delete(id);
}

function addPlayer(player) {
  players.set(player.id, player);
  renderStates.set(player.id, createRenderState());
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

// Where everyone else is already sitting, so nobody lands on an occupied seat.
function takenSeats(player) {
  const taken = [];
  for (const other of players.values()) {
    if (other.id !== player.id && other.state === 'sitting') {
      taken.push({ x: other.x, y: other.y });
    }
  }
  return taken;
}

// How loud a thing one player does sounds to the player at the keyboard.
// Everyone is heard from where you are standing, which is the whole reason the
// room is worth being in.
function loudnessOf(player) {
  if (player.id === LOCAL_ID) return 1;
  const me = players.get(LOCAL_ID);
  if (!me) return 0;
  return gainFor(player, me.x, me.y, AUDIO.nearby.near, AUDIO.nearby.far);
}

// Sound is driven by what changed in a player's state, never by what was
// pressed. applyMovement and applyInteraction have to stay pure — they will run
// on a server one day — so nothing in them may reach an audio device. Reading
// the difference here instead keeps them clean and has a second benefit: a
// player arriving over the wire moves through exactly the same path, so other
// people's footsteps and chairs will sound without a line of new code.
function soundChanges(player, before, renderState, footfallsBefore) {
  const loudness = loudnessOf(player);
  if (loudness <= 0) return;

  if (player.state !== before.state) {
    play(player.state === 'sitting' ? 'sit' : 'stand', loudness);
  }

  if (player.coffees > before.coffees) {
    play('coffee', loudness);
  }

  // The jukebox answers with a click either way — pressing a button that
  // produces silence has to still feel like pressing a button.
  if (player.music !== before.music) {
    play('click', loudness);
  }

  // One footstep per completed bob cycle. A tick that covers several — a slow
  // frame, or a snapshot arriving late — is still only worth one footfall; a
  // burst of them reads as a stumble.
  if (renderState.footfalls > footfallsBefore) {
    play('step', loudness);
  }
}

// One player, one tick. Identical for everyone in the map: whether the input
// came from this keyboard or from a snapshot makes no difference here.
function stepPlayer(player, input, dt) {
  const before = { state: player.state, coffees: player.coffees, music: player.music };
  const renderState = renderStates.get(player.id);
  const footfallsBefore = renderState.footfalls;

  // Interactions first: they can stand a seated player up in time for the
  // same tick's movement.
  Object.assign(player, applyInteraction(player, input, room, takenSeats(player)));

  if (!isSeated(player)) {
    const moved = applyMovement(player, input, dt, room);
    player.x = moved.x;
    player.y = moved.y;
    player.state = 'walking';
  }

  // Render state last, so it reacts to where the player actually ended up.
  advanceBob(renderState, player, dt);

  soundChanges(player, before, renderState, footfallsBefore);
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

  const me = players.get(LOCAL_ID);
  rememberCoffees(me.coffees);

  // The room hums, the jukebox plays and the garden chirps from wherever they
  // are; this is the one place that tells them where the listener is standing.
  ambience.update(me, room, me.music);
}

// What Enter would do from where the player is standing.
function promptFor(player) {
  if (isSeated(player)) return '';
  const zone = room ? room.zoneAt(player.x, player.y) : null;
  if (!zone) return '';
  if (zone.type === 'counter') return 'ENTER  coffee';
  if (zone.type === 'jukebox') return player.music ? 'ENTER  stop the music' : 'ENTER  play something';
  return zone.seats && zone.seats.length ? 'ENTER  sit' : '';
}

function render() {
  ctx.imageSmoothingEnabled = false;
  drawBackground(ctx, art.bg);
  drawPlayers(ctx, players, renderStates);
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
    if (existing) Object.assign(existing, incoming);
    else addPlayer(createPlayer(incoming));
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

// Re-fetch the room PNGs past the cache, leaving every player where they stand.
async function reloadArt() {
  const bust = '?t=' + Date.now();
  const [bg, fg] = await Promise.all([
    loadImage(PATHS.assets + 'room-bg.png' + bust),
    loadImage(PATHS.assets + 'room-fg.png' + bust),
  ]);
  art.bg = bg;
  art.fg = fg;
}

async function boot() {
  const [loadedRoom, bg, fg] = await Promise.all([
    loadRoom(),
    loadImage(PATHS.assets + 'room-bg.png').catch(() => null),
    loadImage(PATHS.assets + 'room-fg.png').catch(() => null),
    loadFaces(),
  ]);

  room = loadedRoom;
  art.bg = bg;
  art.fg = fg;

  // The title screen blocks here until the player picks a name and a cat.
  const choice = await showTitle();

  const me = createPlayer({
    id: LOCAL_ID,
    name: choice.name,
    faceId: choice.faceId,
    x: room.spawn.x,
    y: room.spawn.y,
  });
  me.coffees = readCoffees();
  me.holdingCoffee = me.coffees > 0;
  savedCoffees = me.coffees;
  addPlayer(me);

  // Audio was unlocked by the title screen's first click, so the loops can
  // start the moment the player walks in.
  ambience.start();

  attachInput();
  editor = createDebugEditor({ canvas, room, loop, players, localId: LOCAL_ID, reloadArt });
  net.connect();
  loop.start();

  // A handle for the console and for the debug editor in phase 7. Read-only in
  // spirit: the game never reads anything back off it.
  window.cafe = { players, renderStates, room, art, loop, editor, audio, ambience };
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

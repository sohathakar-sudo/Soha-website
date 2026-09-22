import { VIEW, PATHS, AUDIO } from './config.js';
import { createLoop } from './loop.js';
import { attachInput, readInput, consumePress } from './input.js';
import { createPlayer, applyMovement, applyInteraction, applyTime, isSeated, isWorking } from './player.js';
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

const between = (range) => range.min + Math.random() * (range.max - range.min);

// A sound that repeats for as long as something stays true — someone working at
// a table, someone with a coffee in front of them. `key` names the countdown in
// render state; null there means the thing is not happening, so the next time it
// starts it waits out a settle first rather than firing on the instant.
function repeating(renderState, key, active, schedule, dt, fire) {
  if (!active) {
    renderState[key] = null;
    return;
  }

  if (renderState[key] === null) {
    renderState[key] = between(schedule.settle);
    return;
  }

  renderState[key] -= dt;
  if (renderState[key] <= 0) {
    renderState[key] = between(schedule.every);
    fire();
  }
}

// Everybody has a habit: even faces type, odd faces write longhand. Derived from
// faceId rather than stored, so it needs nothing synced and somebody changing
// face mid-session simply changes habit. One flurry in five is the other one,
// because nobody only ever does the one thing.
function deskSound(player) {
  const types = player.faceId % 2 === 0;
  const usual = types ? 'type' : 'scribble';
  const other = types ? 'scribble' : 'type';
  return Math.random() < 0.2 ? other : usual;
}

// The doorway a point is standing in, or null. Doors are not zones in
// room.json — the layout colour key has no colour for one — so they are matched
// against the list in config rather than through room.zoneAt.
function doorAt(x, y) {
  for (const door of AUDIO.doors || []) {
    if (x >= door.x && x <= door.x + door.w && y >= door.y && y <= door.y + door.h) {
      return door.id;
    }
  }
  return null;
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
function soundChanges(player, before, renderState, footfallsBefore, dt) {
  // Which doorway they are in is tracked whether or not anybody can hear it.
  // Otherwise someone who walks through a door while out of earshot slams it
  // the moment they come back into range.
  const doorBefore = renderState.doorId;
  const doorNow = doorAt(player.x, player.y);
  renderState.doorId = doorNow;

  const loudness = loudnessOf(player);
  if (loudness <= 0) return;

  // Stepping into a doorway swings it open; stepping out lets it fall shut.
  // undefined rather than null is the first look at this player, and someone
  // spawning in a doorway should not arrive by slamming it.
  if (doorBefore !== undefined && doorNow !== doorBefore) {
    play(doorNow ? 'doorOpen' : 'doorClose', loudness);
  }

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

  // Somebody getting on with something. isWorking is the whole hook for the
  // focus timer: narrow it and all of this stops when the session does.
  repeating(renderState, 'nextDesk', isWorking(player), AUDIO.desk, dt, () => {
    play(deskSound(player), loudness);
  });

  // And drinking it, which only happens at a table. Standing up ends it; a cup
  // with time left on it picks up again when they sit back down.
  repeating(
    renderState,
    'nextSip',
    isWorking(player) && player.holdingCoffee,
    AUDIO.sipping,
    dt,
    () => play(Math.random() < AUDIO.sipping.cutleryChance ? 'cutlery' : 'sip', loudness),
  );
}

// One player, one tick. Identical for everyone in the map: whether the input
// came from this keyboard or from a snapshot makes no difference here.
function stepPlayer(player, input, dt) {
  const before = { state: player.state, coffees: player.coffees, music: player.music };
  const renderState = renderStates.get(player.id);
  const footfallsBefore = renderState.footfalls;

  // Time passes before anything else, so a coffee bought this tick gets its
  // full two minutes rather than being a tick short of them.
  Object.assign(player, applyTime(player, dt));

  // Interactions next: they can stand a seated player up in time for the
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

  soundChanges(player, before, renderState, footfallsBefore, dt);
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
  ambience.update(me, me.music);
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
  // The tally is a lifetime count and is remembered. The cup is not: a coffee
  // does not survive a reload, so a returning player starts with empty hands.
  me.coffees = readCoffees();
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

import { VIEW, PATHS, AUDIO, NET } from './config.js';
import { createLoop } from './loop.js';
import { attachInput, readInput, consumePress } from './input.js';
import { createPlayer, applyMovement, applyInteraction, applyTime, isSeated, isWorking } from './player.js';
import { loadFaces, loadProps, loadImage, createRenderState, advanceBob } from './faces.js';
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
const display = canvas.getContext('2d', { alpha: false });

// --- The two canvases ------------------------------------------------------
// Everything is drawn into a buffer that is 640x360 and stays that way: the
// room, the people, the HUD, the editor. Every draw call in the game works in
// those coordinates and never learns that a screen has a size.
//
// Only the last step scales, one drawImage per frame onto the canvas the page
// can see. That is what keeps the look honest — the pixels are still authored
// at native resolution, so the 8px HUD text stays chunky instead of turning
// into smooth type the moment the window gets bigger.
const buffer = document.createElement('canvas');
buffer.width = VIEW.width;
buffer.height = VIEW.height;
const ctx = buffer.getContext('2d', { alpha: false });

// --- Scaling ---------------------------------------------------------------
// Scale against the element the canvas sits in, not the window, so the game
// also behaves when embedded in a page with other content around it.
//
// Whole-number scaling is the rule on an ordinary screen: it is the only way a
// 640x360 picture reaches a 1512px window without some pixels landing two
// across and others three, which on 2px line work is glaring. The cost is the
// letterbox — 1512 / 640 is 2.36, the floor of that is 2, and the leftover
// 232px is black.
//
// On a 2x display that cost stops being worth paying. There are four or five
// device pixels under every pixel of the room, the unevenness disappears into
// them, and the window can simply be filled. Aspect ratio is always preserved,
// so a thin bar on one axis remains: 640x360 is exactly 16:9 and a browser
// window is not.
const stage = canvas.parentElement;
let scale = 1;

function resize() {
  const availW = stage.clientWidth || window.innerWidth;
  const availH = stage.clientHeight || window.innerHeight;
  const dpr = window.devicePixelRatio || 1;

  const fitX = availW / VIEW.width;
  const fitY = availH / VIEW.height;
  const fit = Math.min(fitX, fitY, VIEW.maxScale);

  scale = Math.max(1, dpr >= VIEW.fluidMinDpr ? fit : Math.floor(fit));

  // Styled in CSS pixels, backed in device pixels, so the blit has the real
  // resolution of the screen to land on rather than being stretched by the
  // compositor afterwards.
  canvas.style.width = `${VIEW.width * scale}px`;
  canvas.style.height = `${VIEW.height * scale}px`;
  canvas.width = Math.round(VIEW.width * scale * dpr);
  canvas.height = Math.round(VIEW.height * scale * dpr);

  // Resizing a canvas resets its context, so this has to be set again here.
  display.imageSmoothingEnabled = false;
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

// The latest state each remote player reported over the wire, keyed by their id.
// Applied to the player during its tick (not the moment it arrives) so the sound
// system sees transitions and a remote's sit, stand and coffee are heard just
// like a local one's. Empty in solo play.
const remoteWire = new Map();

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

// --- Remote players --------------------------------------------------------
// Everyone who is not the local player arrives, updates and leaves through here.
// They are ordinary entries in the same `players` map — only their input differs
// (it comes off the wire, not the keyboard) and their position is eased rather
// than simulated.
function addRemote(wire) {
  remoteWire.set(wire.id, wire);
  if (players.has(wire.id)) return;

  const player = createPlayer(wire);
  // Start them in the state they are already in, so arriving to find someone
  // seated doesn't replay a sit the moment they are drawn.
  player.state = wire.state === 'sitting' ? 'sitting' : 'walking';
  player.holdingCoffee = !!wire.holdingCoffee;
  player.coffees = wire.coffees || 0;
  addPlayer(player);

  // Prime the render state at their reported spot: no glide in from the origin,
  // and no phantom stride on the first frame.
  const rs = renderStates.get(wire.id);
  rs.netX = wire.x;
  rs.netY = wire.y;
  rs.lastX = wire.x;
  rs.lastY = wire.y;
}

function dropRemote(id) {
  if (id === LOCAL_ID) return;
  removePlayer(id);
  remoteWire.delete(id);
}

function dropAllRemotes() {
  for (const id of [...players.keys()]) {
    if (id !== LOCAL_ID) dropRemote(id);
  }
}

// How the wire's messages move the players map. main.js owns the map; net.js
// only decodes. Registered once at load so a welcome is never missed.
net.on({
  welcome: ({ players: roster }) => {
    for (const wire of roster || []) addRemote(wire);
  },
  join: (wire) => addRemote(wire),
  state: (wire) => {
    if (wire.id === net.getMyId()) return; // never animate our own echo
    if (players.has(wire.id)) remoteWire.set(wire.id, wire);
    else addRemote(wire);
  },
  leave: (id) => dropRemote(id),
  full: () => console.warn(`The café is full (max ${NET.maxPlayers}). Others won't see you yet.`),
});

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

// The surface a seated player is at. A table in the café, a rail in the garden
// — either way it is the thing in front of them, and it is what a laptop and a
// cup get put down on.
function tableUnder(player) {
  if (!room) return null;
  let best = null, bestD = 64 * 64;
  for (const s of room.solids) {
    if (s.kind !== 'table' && s.kind !== 'bar') continue;
    // Distance to the nearest point on it rather than to its middle: a rail is
    // long, and somebody sitting at one end is not sitting far away.
    const nx = Math.min(Math.max(player.x, s.x), s.x + s.w);
    const ny = Math.min(Math.max(player.y, s.y), s.y + s.h);
    const d = (nx - player.x) ** 2 + (ny - player.y) ** 2;
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

// Turning to face what you sat down at, and putting your laptop on it.
//
// Both are worked out from position rather than stored on the player, so a
// player arriving over the wire turns and unpacks exactly like a local one
// without a byte of extra state on the wire.
function faceTheTable(player, renderState) {
  if (!isSeated(player)) {
    renderState.faceAngle = 0;
    renderState.deskAt = null;
    renderState.cupAt = null;
    return;
  }

  const table = tableUnder(player);
  if (!table) return;

  // Aim at the nearest point on the surface, so a rail is judged by the edge
  // beside you rather than by its distant middle.
  const cx = Math.min(Math.max(player.x, table.x), table.x + table.w);
  const cy = Math.min(Math.max(player.y, table.y), table.y + table.h);
  const dx = cx - player.x, dy = cy - player.y;
  if (dx === 0 && dy === 0) return;

  // Square on to the nearest edge: a hand-drawn face has no in-between poses.
  const angle = Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? -Math.PI / 2 : Math.PI / 2)
    : (dy > 0 ? 0 : Math.PI);
  renderState.faceAngle = angle;

  // The laptop sits on the table, just inside the edge they are facing, and the
  // cup goes down beside it — on the table rather than in their hand, because
  // that is what you do with a coffee when you sit down to work.
  const inset = 13;
  const sideways = Math.abs(dx) > Math.abs(dy);
  renderState.deskAt = sideways
    ? { x: dx > 0 ? table.x + inset : table.x + table.w - inset, y: player.y - 6 }
    : { x: player.x, y: dy > 0 ? table.y + inset : table.y + table.h - inset };

  // Set down to their right, along the edge they are sitting at, and kept
  // inside the table however close to a corner they sat.
  const reach = 19;
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  renderState.cupAt = sideways
    ? { x: renderState.deskAt.x, y: clamp(renderState.deskAt.y + reach * (dx > 0 ? 1 : -1), table.y + 8, table.y + table.h - 8) }
    : { x: clamp(renderState.deskAt.x + reach * (dy > 0 ? -1 : 1), table.x + 8, table.x + table.w - 8), y: renderState.deskAt.y };
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
    // The till first, then the drink: you pay before you are handed anything.
    play('register', loudness);
    play('coffee', loudness, 0.35);
  }

  // The jukebox answers with a click either way — pressing a button that
  // produces silence has to still feel like pressing a button.
  if (player.music !== before.music) {
    play('click', loudness);
  }

  if (player.leaving) {
    player.leaving = false;
    if (player.id === LOCAL_ID) leaving = true;
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

// One player, one tick. The local player is simulated from the keyboard; a
// remote one is moved toward the position it last reported. Everything after
// that — bob, facing, and the sound its state change makes — is identical for
// both, which is the whole reason remote footsteps and chairs cost no new code.
function stepPlayer(player, input, dt) {
  const before = { state: player.state, coffees: player.coffees, music: player.music };
  const renderState = renderStates.get(player.id);
  const footfallsBefore = renderState.footfalls;

  if (player.id === LOCAL_ID) {
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
  } else {
    stepRemote(player, renderState);
  }

  // Render state last, so it reacts to where the player actually ended up.
  advanceBob(renderState, player, dt);
  faceTheTable(player, renderState);

  soundChanges(player, before, renderState, footfallsBefore, dt);
}

// A remote player is not simulated — it is shown. The state it reported is
// applied here, inside the tick rather than the instant it arrived, so the
// `before` snapshot above still holds the old state and soundChanges hears the
// transition. The position is eased toward the report: advanceBob reads the
// per-tick distance, so a smooth glide also yields a true bob and footstep.
function stepRemote(player, renderState) {
  const wire = remoteWire.get(player.id);
  if (wire) {
    player.state = wire.state === 'sitting' ? 'sitting' : 'walking';
    player.faceId = wire.faceId;
    player.name = wire.name;
    player.holdingCoffee = !!wire.holdingCoffee;
    player.coffees = wire.coffees || 0;
    renderState.netX = wire.x;
    renderState.netY = wire.y;
  }

  if (renderState.netX != null) {
    player.x += (renderState.netX - player.x) * NET.remoteLerp;
    player.y += (renderState.netY - player.y) * NET.remoteLerp;
    // Settle exactly onto the target once within a pixel, so a standing player
    // is perfectly still rather than forever creeping the last fraction.
    if (Math.abs(renderState.netX - player.x) < 0.1 && Math.abs(renderState.netY - player.y) < 0.1) {
      player.x = renderState.netX;
      player.y = renderState.netY;
    }
  }
}

// --- Loop ------------------------------------------------------------------
let tick = 0;

function update(dt) {
  if (leaving) return;
  tick++;

  if (consumePress('Backquote') && editor) editor.toggle();

  // Reading this keyboard is a local concern, so it happens here rather than
  // inside the loop that treats every player alike.
  const localInput = readInput();

  for (const player of players.values()) {
    stepPlayer(player, inputFor(player, localInput), dt);
  }

  const me = players.get(LOCAL_ID);
  rememberCoffees(me.coffees);

  // Send where we ended up, not what was pressed: this is a relay, so the room
  // carries state rather than input. Throttled and skipped when nothing changed,
  // both inside net.sendState, so a still player sends nothing.
  net.sendState(me);

  if (leaving) { leave(); return; }

  // The room hums, the jukebox plays and the garden chirps from wherever they
  // are; this is the one place that tells them where the listener is standing.
  ambience.update(me, me.music);
}

// --- Leaving ---------------------------------------------------------------
// Standing on the welcome mat and pressing Enter takes you back out to the
// title screen. The flag is read at the top of the next tick rather than acted
// on the instant it is set: tearing the room down from inside the loop that is
// walking it is how you get a half-stepped player.
let leaving = false;

async function leave() {
  loop.stop();
  if (editor && editor.active) editor.toggle();

  // Tell the room we've stepped out, and clear everyone else: when we walk back
  // in, the relay's welcome repopulates them from scratch.
  net.leaveRoom();
  dropAllRemotes();

  const me = players.get(LOCAL_ID);
  removePlayer(LOCAL_ID);

  play('doorOpen');
  play('door', 1, 0.18);
  play('doorClose', 1, 0.55);

  // Back to the door, with the same name and face already filled in.
  const choice = await showTitle();
  enter(choice, me ? me.coffees : 0);
}

// Walking in: a fresh player on the spawn, the loop running again.
function enter(choice, coffees) {
  const me = createPlayer({
    id: LOCAL_ID,
    name: choice.name,
    faceId: choice.faceId,
    x: room.spawn.x,
    y: room.spawn.y,
  });
  me.coffees = coffees;
  savedCoffees = coffees;
  addPlayer(me);

  // Announce ourselves to the room, with where we are standing so the others
  // see us at the door rather than briefly at the origin. No-op in solo play.
  net.identify({ name: me.name, faceId: me.faceId, x: me.x, y: me.y, state: me.state });

  leaving = false;
  ambience.start();
  loop.start();
}

// What Enter would do from where the player is standing.
function promptFor(player) {
  if (isSeated(player)) return '';
  const zone = room ? room.zoneAt(player.x, player.y) : null;
  if (!zone) return '';
  if (zone.type === 'door') return 'ENTER  leave the café';
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
  // corners. And between walking out and picking a face again there is nobody
  // to draw a HUD for — the room is still there, the person is not.
  if (editor && editor.active) {
    editor.draw(ctx);
  } else if (me) {
    drawHud(ctx, me, promptFor(me));
  }

  // And the one scaling step: 640x360 onto however big the screen is.
  display.drawImage(buffer, 0, 0, canvas.width, canvas.height);
}

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
    loadProps(['laptop', 'cup']),
  ]);

  room = loadedRoom;
  art.bg = bg;
  art.fg = fg;

  attachInput();
  // Open the relay if one is configured. Resolves either way — a café that can't
  // reach its relay still opens as a quiet solo room. net.on(...) above is
  // already listening, so a welcome on connect is handled.
  net.connect(NET.url);

  // The title screen blocks here until the player picks a name and a face.
  const choice = await showTitle();

  // The tally is a lifetime count and is remembered. The cup is not: a coffee
  // does not survive a reload, so a returning player starts with empty hands.
  enter(choice, readCoffees());

  editor = createDebugEditor({ canvas, room, loop, players, localId: LOCAL_ID, reloadArt });

  // A handle for the console and for the debug editor in phase 7. Read-only in
  // spirit: the game never reads anything back off it.
  window.cafe = { players, renderStates, room, art, loop, editor, audio, ambience };
}

boot().catch((err) => {
  console.error(err);
  // Drawn into the buffer like everything else, then blitted once by hand:
  // the loop that would normally do it never started.
  ctx.fillStyle = '#1a1a1e';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = '#e8e8ec';
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  ctx.fillText('Could not start: ' + err.message, 8, 8);
  ctx.fillText('The game needs a server — see cafe/README.md', 8, 20);
  display.drawImage(buffer, 0, 0, canvas.width, canvas.height);
});

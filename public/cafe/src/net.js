// The multiplayer client.
//
// A relay, mirroring cafe-server/: the local player runs on this machine with
// the game's own pure functions, and this module only carries its state to the
// relay and other people's state back. It never simulates anyone — main.js
// does that for everyone in the `players` map alike.
//
// The whole module is a no-op when NET.url is empty. `connect('')` resolves
// disconnected, and identify / sendState / leaveRoom do nothing, so the café is
// exactly its single-player self with no server. That is what keeps the folder
// droppable on any static host.
//
// Messages, both ways, are small JSON objects tagged with `t`:
//   out: hello {name,faceId,…}  state {…}  bye  ping
//   in : welcome {id, players[]}  join {player}  state {player}  leave {id}  full

import { NET } from './config.js';

// The fields the local player puts on the wire. `music` is not among them: the
// jukebox is a personal preference and never travels (Soha's call).
const WIRE_FIELDS = ['x', 'y', 'state', 'faceId', 'name', 'holdingCoffee', 'coffees'];

let ws = null;
let url = '';
let myId = null;          // the id the relay assigned us; null until welcomed
let identity = null;      // the last {name, faceId} we announced, for reconnects
let inRoom = false;       // have we sent hello and not yet bye?
let deliberateClose = false;

let handlers = {};        // { welcome, join, state, leave, full }

// Send throttling and change detection, so a still player sends nothing.
let lastSentAt = 0;
let lastSent = null;
let lastActivityAt = 0;   // last time anything went out, for the keepalive

let reconnectDelay = 0;
let reconnectTimer = null;
let pingTimer = null;

function now() {
  return (typeof performance !== 'undefined' ? performance : Date).now();
}

// Register the game's reactions to what arrives. Keeps main.js in charge of the
// players map; this module only decodes the wire.
export function on(map) {
  handlers = map || {};
}

export function getMyId() {
  return myId;
}

export function isConnected() {
  return !!ws && ws.readyState === WebSocket.OPEN;
}

// Open the socket. Resolves once (connected or not); it never rejects, because a
// café that cannot reach its relay should still open as a quiet single-player
// room rather than refuse to start.
export function connect(target = NET.url) {
  url = target || '';
  if (!url) return Promise.resolve({ connected: false });

  return new Promise((resolve) => {
    let settled = false;
    const done = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    try {
      openSocket(done);
    } catch {
      done({ connected: false });
    }

    // Don't hang the title screen on a slow or dead relay.
    setTimeout(() => done({ connected: false }), 4000);
  });
}

function openSocket(onOpen) {
  ws = new WebSocket(url);

  ws.addEventListener('open', () => {
    reconnectDelay = 0;
    startPing();
    // A reconnect while already in the room re-announces us so the others,
    // who saw us leave, see us arrive again.
    if (inRoom && identity) {
      lastSent = null;
      sendHello(identity);
    }
    if (onOpen) onOpen({ connected: true });
  });

  ws.addEventListener('message', (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    route(msg);
  });

  ws.addEventListener('close', () => {
    stopPing();
    ws = null;
    myId = null;
    if (!deliberateClose) scheduleReconnect();
  });

  ws.addEventListener('error', () => {
    // The close event follows and does the cleanup; swallow the noise.
    try { ws && ws.close(); } catch { /* already gone */ }
  });
}

function route(msg) {
  switch (msg && msg.t) {
    case 'welcome':
      myId = msg.id;
      handlers.welcome && handlers.welcome(msg);
      break;
    case 'join':
      handlers.join && msg.player && handlers.join(msg.player);
      break;
    case 'state':
      handlers.state && msg.player && handlers.state(msg.player);
      break;
    case 'leave':
      handlers.leave && handlers.leave(msg.id);
      break;
    case 'full':
      handlers.full && handlers.full();
      break;
    default:
      break;
  }
}

function scheduleReconnect() {
  if (reconnectTimer || !url) return;
  const r = NET.reconnect;
  reconnectDelay = reconnectDelay ? Math.min(reconnectDelay * 2, r.maxMs) : r.startMs;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    openSocket(null);
  }, reconnectDelay);
}

// Announce we have walked in (or walked back in). Called from enter() with the
// spawn position, so the others see us at the door immediately rather than at
// the origin for the fraction of a second before our first state goes out.
export function identify(choice) {
  identity = {
    name: choice.name,
    faceId: choice.faceId,
    x: Math.round(choice.x) || 0,
    y: Math.round(choice.y) || 0,
    state: choice.state === 'sitting' ? 'sitting' : 'walking',
  };
  inRoom = true;
  lastSent = null; // force the first state to go out
  if (isConnected()) sendHello(identity);
}

function sendHello(id) {
  send({ t: 'hello', name: id.name, faceId: id.faceId, x: id.x, y: id.y, state: id.state });
}

// Send the local player's state, throttled and only when it changed. Called
// every tick; most ticks it does nothing, which is what keeps the café free.
export function sendState(player) {
  if (!inRoom || !isConnected()) return;

  const t = now();
  if (t - lastSentAt < 1000 / NET.sendHz) return;

  const payload = {};
  for (const field of WIRE_FIELDS) payload[field] = player[field];
  // Whole pixels: sub-pixel jitter would defeat the change check and the room
  // is only 640 wide, so nobody can see the rounding.
  payload.x = Math.round(payload.x);
  payload.y = Math.round(payload.y);

  if (lastSent && unchanged(payload, lastSent)) return;

  lastSent = payload;
  lastSentAt = t;
  send({ t: 'state', ...payload });
}

function unchanged(a, b) {
  for (const field of WIRE_FIELDS) {
    if (a[field] !== b[field]) return false;
  }
  return true;
}

// Walking back out to the title screen: tell the room, but keep the socket for
// when they walk in again.
export function leaveRoom() {
  if (inRoom && isConnected()) send({ t: 'bye' });
  inRoom = false;
  lastSent = null;
}

function send(obj) {
  if (!isConnected()) return;
  try {
    ws.send(JSON.stringify(obj));
    lastActivityAt = now();
  } catch {
    /* socket going down; the close handler will reconnect */
  }
}

function startPing() {
  stopPing();
  lastActivityAt = now();
  pingTimer = setInterval(() => {
    if (!isConnected()) return;
    if (now() - lastActivityAt >= NET.pingSeconds * 1000) send({ t: 'ping' });
  }, NET.pingSeconds * 1000);
}

function stopPing() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

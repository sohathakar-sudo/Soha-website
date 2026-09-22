import { NET } from './config.js';

// The wire. A relay, not an authority: everybody simulates themselves and
// broadcasts their own state, and the server forwards it without understanding
// any of it. See MULTIPLAYER.md for why that trade is the right one here.
//
// This file used to be a stub shaped for an authoritative server — sendInput,
// onSnapshot. A relay inverts both: you send your own state and you receive
// other people's. The loop calls into the same three places; they mean
// different things now.
//
// Offline is the normal case and must stay silent. With no relay configured,
// or with one that will not answer, the café is exactly the single-player room
// it was — no errors, no retry storm, nothing in the console.

let socket = null;
let myId = null;
let peerHandler = null;
let goneHandler = null;
let connected = false;

// When each peer was last heard from. Silence is the only evidence we get that
// somebody's laptop shut, so it has to be watched.
const lastSeen = new Map();
let sweeper = null;
let retryDelay = 0;
let wantConnection = false;

// A name for this tab on the wire. The local player is keyed 'local' inside the
// game and always will be, so it needs something of its own out here.
function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'p' + Math.random().toString(36).slice(2, 10);
}

export function id() {
  return myId;
}

export function isConnected() {
  return connected;
}

// Where the relay is, or null to stay offline. Localhost gets a default so the
// thing can be run and tested with no configuration; anywhere else has to be
// told explicitly, because a deployed café must not go hunting for a server
// that was never set up.
function relayUrl() {
  if (NET.url) return NET.url;
  try {
    const override = localStorage.getItem('cafe:relay');
    if (override) return override;
  } catch { /* storage unavailable; fall through to the default */ }

  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  return local ? `ws://${location.hostname}:${NET.devPort}` : null;
}

// Anybody who has gone quiet for too long has gone. Read from config each pass
// rather than captured, so the timeout can be changed without a reload.
function sweep() {
  const cutoff = Date.now() - NET.presence.timeoutSeconds * 1000;
  for (const [peerId, seen] of lastSeen) {
    if (seen > cutoff) continue;
    lastSeen.delete(peerId);
    if (goneHandler) goneHandler(peerId);
  }
}

function startSweeping() {
  clearInterval(sweeper);
  sweeper = setInterval(sweep, NET.presence.sweepSeconds * 1000);
}

// Everyone we thought was here is no longer accounted for. Said plainly rather
// than left to the sweep, so a dropped connection empties the room at once
// instead of over the next minute.
function forgetEveryone() {
  for (const peerId of [...lastSeen.keys()]) {
    lastSeen.delete(peerId);
    if (goneHandler) goneHandler(peerId);
  }
}

export function connect() {
  const url = relayUrl();
  if (!url || typeof WebSocket === 'undefined') return Promise.resolve({ connected: false });

  if (!myId) myId = makeId();
  wantConnection = true;
  startSweeping();

  return new Promise((resolve) => {
    let settled = false;
    const done = (ok) => { if (!settled) { settled = true; resolve({ connected: ok }); } };

    // Nothing here is urgent, so the wait grows rather than hammering a relay
    // that is down.
    const retry = () => {
      if (!wantConnection) return;
      retryDelay = retryDelay
        ? Math.min(retryDelay * 2, NET.reconnect.maxDelaySeconds)
        : NET.reconnect.firstDelaySeconds;
      setTimeout(() => { if (wantConnection) connect(); }, retryDelay * 1000);
    };

    try {
      socket = new WebSocket(url);
    } catch {
      retry();
      return done(false);
    }

    socket.addEventListener('open', () => {
      connected = true;
      retryDelay = 0;
      done(true);
    });

    socket.addEventListener('message', (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (!message || typeof message !== 'object') return;

      // Never let an echo of ourselves in. The relay does not send one back,
      // but the local player is simulated here and nothing from the wire may
      // touch it — that is the difference between a relay and an authority.
      if (message.type === 'state' && message.player && message.player.id !== myId) {
        lastSeen.set(message.player.id, Date.now());
        if (peerHandler) peerHandler(message.player);
      } else if (message.type === 'gone' && message.id !== myId) {
        lastSeen.delete(message.id);
        if (goneHandler) goneHandler(message.id);
      }
    });

    // A café that cannot reach its relay is still a café.
    socket.addEventListener('error', () => { connected = false; done(false); });
    socket.addEventListener('close', () => {
      connected = false;
      // Whoever was here is no longer ours to vouch for.
      forgetEveryone();
      retry();
      done(false);
    });
  });
}

// Leaving properly: through the door, or by closing the tab. Both are worth
// saying out loud, because the alternative is everybody else waiting out the
// timeout while your face stands frozen on the welcome mat.
export function announceGone() {
  if (!connected || !socket || socket.readyState !== WebSocket.OPEN) return;
  try { socket.send(JSON.stringify({ type: 'bye', id: myId })); } catch { /* going anyway */ }
}

if (typeof window !== 'undefined') {
  // pagehide rather than beforeunload: it is the one that fires reliably on
  // mobile and on a tab being closed. Being hidden is NOT leaving — the café
  // keeps playing in a background tab on purpose.
  window.addEventListener('pagehide', announceGone);
}

// Called only when the local player actually changed — see the diff in main.js.
// A seated person sends nothing at all, which is most of why this is affordable.
export function publish(player) {
  if (!connected || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: 'state', player: { ...player, id: myId } }));
}

export function onPeer(handler) {
  peerHandler = handler;
}

export function onGone(handler) {
  goneHandler = handler;
}

export function disconnect() {
  wantConnection = false;
  announceGone();
  connected = false;
  clearInterval(sweeper);
  sweeper = null;
  forgetEveryone();
  if (socket) socket.close();
  socket = null;
}

// Who we believe is still here, and how long since each of them said so. For
// the console: presence is otherwise invisible until it goes wrong.
export function peers() {
  const now = Date.now();
  return [...lastSeen].map(([peerId, seen]) => ({ id: peerId, quietFor: (now - seen) / 1000 }));
}

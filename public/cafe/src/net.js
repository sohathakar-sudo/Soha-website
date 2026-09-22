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

export function connect() {
  const url = relayUrl();
  if (!url || typeof WebSocket === 'undefined') return Promise.resolve({ connected: false });

  myId = makeId();

  return new Promise((resolve) => {
    let settled = false;
    const done = (ok) => { if (!settled) { settled = true; resolve({ connected: ok }); } };

    try {
      socket = new WebSocket(url);
    } catch {
      return done(false);
    }

    socket.addEventListener('open', () => { connected = true; done(true); });

    socket.addEventListener('message', (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (!message || typeof message !== 'object') return;

      // Never let an echo of ourselves in. The relay does not send one back,
      // but the local player is simulated here and nothing from the wire may
      // touch it — that is the difference between a relay and an authority.
      if (message.type === 'state' && message.player && message.player.id !== myId) {
        if (peerHandler) peerHandler(message.player);
      } else if (message.type === 'gone' && message.id !== myId) {
        if (goneHandler) goneHandler(message.id);
      }
    });

    // A café that cannot reach its relay is still a café.
    socket.addEventListener('error', () => { connected = false; done(false); });
    socket.addEventListener('close', () => { connected = false; done(false); });
  });
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
  connected = false;
  if (socket) socket.close();
  socket = null;
}

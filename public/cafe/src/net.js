// Multiplayer stub. Does nothing yet; the game loop already calls into it at the
// points where a networked build would need them, so wiring a server in later is
// a matter of filling these in rather than restructuring the loop.

let snapshotHandler = null;

export function connect(/* url, identity */) {
  // Later: open a WebSocket, handshake, resolve when the first snapshot lands.
  return Promise.resolve({ connected: false });
}

export function sendInput(/* input, tick */) {
  // Later: serialise the local input for this tick and send it to the server.
}

export function onSnapshot(handler) {
  // Later: the transport calls this with authoritative room state.
  snapshotHandler = handler;
}

export function _receiveSnapshot(snapshot) {
  if (snapshotHandler) snapshotHandler(snapshot);
}

export function isConnected() {
  return false;
}

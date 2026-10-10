// The café's multiplayer relay.
//
// This is a *relay*, not an authoritative game server: it never simulates the
// café. Each browser runs its own player with the game's own pure functions and
// sends its resulting state; this object just remembers everyone's latest state
// and forwards it to the others. Nothing here trusts or checks the simulation,
// because in a cozy café there is nothing to cheat at.
//
// One Durable Object instance — reached by the fixed name "cafe" — is the one
// shared room. If the café ever wants private rooms, it is one line: name the
// instance after the room instead of "cafe".
//
// Staying inside Cloudflare's free tier is a design constraint, not an
// afterthought, so two rules matter:
//   1. The WebSocket Hibernation API (state.acceptWebSocket) is used rather than
//      ws.accept(), so an idle or empty room is evicted from memory and bills no
//      duration at all.
//   2. The client only sends when something changes, so a room full of people
//      sitting and working sends almost nothing. Incoming messages are the only
//      billable traffic (and at a 20:1 ratio); everything this object sends out
//      is free.

const MAX_PLAYERS = 15; // = the number of seats in the current room.json
const NAME_MAX = 16;

// Fields a client is allowed to set on its own player. Anything else on an
// incoming message is ignored — the wire cannot invent new state.
//
// `music` is deliberately absent: the jukebox is a per-listener preference and
// never travels, so switching it off is quiet for you alone.
const STATE_FIELDS = ['x', 'y', 'state', 'faceId', 'name', 'holdingCoffee', 'coffees'];

export class CafeRoom {
  constructor(state) {
    this.state = state;
    // Sockets persist across hibernation; this map is rebuilt lazily from their
    // attachments after the object wakes, so it is only a cache.
    this.meta = new Map(); // ws -> { id, inRoom, player }
  }

  // Rebuild the per-socket cache from the attachments the runtime kept for us.
  // Called at the top of every handler so a just-woken object is consistent.
  hydrate() {
    for (const ws of this.state.getWebSockets()) {
      if (!this.meta.has(ws)) {
        const saved = ws.deserializeAttachment();
        if (saved) this.meta.set(ws, saved);
      }
    }
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Hibernation API: the runtime, not this code, owns the socket, so the
    // object can be evicted between messages and pay nothing while idle.
    this.state.acceptWebSocket(server);

    const meta = { id: crypto.randomUUID(), inRoom: false, player: null };
    server.serializeAttachment(meta);
    this.meta.set(server, meta);

    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, raw) {
    this.hydrate();
    const meta = this.meta.get(ws);
    if (!meta) return;

    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return; // garbage in, nothing out
    }

    switch (msg.t) {
      case 'hello':
        return this.onHello(ws, meta, msg);
      case 'state':
        return this.onState(ws, meta, msg);
      case 'bye':
        return this.onBye(ws, meta);
      case 'ping':
        return; // a keepalive; its arrival already did its job
      default:
        return;
    }
  }

  onHello(ws, meta, msg) {
    // Count who is actually in the room, so a page that merely has a socket open
    // (sitting on the title screen) does not use up a seat.
    const occupied = [...this.meta.values()].filter((m) => m.inRoom).length;
    if (!meta.inRoom && occupied >= MAX_PLAYERS) {
      ws.send(JSON.stringify({ t: 'full' }));
      return;
    }

    meta.player = {
      id: meta.id,
      name: cleanName(msg.name),
      faceId: cleanFace(msg.faceId),
      x: Number(msg.x) || 0,
      y: Number(msg.y) || 0,
      state: msg.state === 'sitting' ? 'sitting' : 'walking',
      holdingCoffee: !!msg.holdingCoffee,
      coffees: Math.max(0, Math.floor(Number(msg.coffees) || 0)),
    };
    meta.inRoom = true;
    ws.serializeAttachment(meta);

    // Tell the newcomer who is already here...
    const others = [...this.meta.values()]
      .filter((m) => m.inRoom && m.id !== meta.id && m.player)
      .map((m) => m.player);
    ws.send(JSON.stringify({ t: 'welcome', id: meta.id, players: others }));

    // ...and tell everyone else that they arrived.
    this.broadcast({ t: 'join', player: meta.player }, ws);
  }

  onState(ws, meta, msg) {
    if (!meta.inRoom || !meta.player) return;

    for (const field of STATE_FIELDS) {
      if (field in msg) meta.player[field] = msg[field];
    }
    // Re-clean the fields a client could abuse, every time.
    meta.player.name = cleanName(meta.player.name);
    meta.player.faceId = cleanFace(meta.player.faceId);
    meta.player.id = meta.id; // never let the wire set someone else's id
    ws.serializeAttachment(meta);

    this.broadcast({ t: 'state', player: meta.player }, ws);
  }

  onBye(ws, meta) {
    if (!meta.inRoom) return;
    meta.inRoom = false;
    ws.serializeAttachment(meta);
    this.broadcast({ t: 'leave', id: meta.id }, ws);
  }

  webSocketClose(ws) {
    this.hydrate();
    const meta = this.meta.get(ws);
    this.meta.delete(ws);
    if (meta && meta.inRoom) {
      this.broadcast({ t: 'leave', id: meta.id }, ws);
    }
  }

  webSocketError(ws) {
    this.webSocketClose(ws);
  }

  // Send to everyone currently connected except `from`. Outgoing messages are
  // free, so fanning out to the whole room on every change costs nothing.
  broadcast(payload, from) {
    const text = JSON.stringify(payload);
    for (const ws of this.state.getWebSockets()) {
      if (ws === from) continue;
      try {
        ws.send(text);
      } catch {
        // A socket mid-teardown; its close event will clean it up.
      }
    }
  }
}

function cleanName(name) {
  if (typeof name !== 'string') return 'guest';
  // Strip control characters, collapse whitespace, clamp length.
  const trimmed = name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, NAME_MAX);
  return trimmed || 'guest';
}

function cleanFace(faceId) {
  const n = Math.floor(Number(faceId));
  return Number.isFinite(n) && n >= 1 && n <= 8 ? n : 1;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // A plain GET is a health check — handy for confirming the Worker is up
    // from a browser before any game points at it.
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('The café relay is running. Connect a WebSocket to join.', {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }

    // One room, one object, reached by a fixed name.
    const id = env.CAFE_ROOM.idFromName('cafe');
    const room = env.CAFE_ROOM.get(id);
    return room.fetch(request);
  },
};

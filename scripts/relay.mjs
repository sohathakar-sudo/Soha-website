// A relay for the café. It forwards messages between browsers and knows
// nothing about cafés.
//
//   npm run relay
//
// This exists so multiplayer can be built and tested without signing up for
// anything. The real deployment is meant to be a hosted pub/sub on a free tier
// (see public/cafe/MULTIPLAYER.md) — this is the same shape, running locally,
// so the game's side of it can be written and proved first.
//
// No dependencies, which means the WebSocket handshake and framing are done by
// hand below. That is about eighty lines of RFC 6455 and it is the boring part
// of the file.

import { createServer } from 'node:http';
import { createHash } from 'node:crypto';

const PORT = Number(process.env.PORT) || 8001;
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

// Telling a dead socket from a quiet one.
//
// These have to be protocol-level pings rather than application messages,
// because a café with nobody else in it deliberately stops sending anything at
// all (see MULTIPLAYER.md §3a). Counting only chat would show such a client the
// door every minute, and it would reconnect, and go quiet, and be shown the
// door again — costing far more than the silence saved. A ping costs nothing on
// anybody's bill and the browser answers it without being asked.
const PING_AFTER_SECONDS = 25;
const IDLE_SECONDS = 70;
const SWEEP_SECONDS = 10;

const peers = new Set();

// --- framing ---------------------------------------------------------------

function frame(text) {
  const body = Buffer.from(text);
  const len = body.length;
  let head;
  if (len < 126) {
    head = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    head = Buffer.alloc(4);
    head[0] = 0x81; head[1] = 126; head.writeUInt16BE(len, 2);
  } else {
    head = Buffer.alloc(10);
    head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([head, body]);
}

// Pulls whole messages out of a growing buffer. A socket hands over bytes, not
// messages, so anything incomplete stays put until the rest arrives.
function drain(peer, onText, onClose) {
  for (;;) {
    const buf = peer.buffer;
    if (buf.length < 2) return;

    const opcode = buf[0] & 0x0f;
    const masked = (buf[1] & 0x80) !== 0;
    let len = buf[1] & 0x7f;
    let offset = 2;

    if (len === 126) {
      if (buf.length < 4) return;
      len = buf.readUInt16BE(2); offset = 4;
    } else if (len === 127) {
      if (buf.length < 10) return;
      len = Number(buf.readBigUInt64BE(2)); offset = 10;
    }

    const maskKey = masked ? buf.subarray(offset, offset + 4) : null;
    if (masked) offset += 4;
    if (buf.length < offset + len) return;

    const payload = Buffer.from(buf.subarray(offset, offset + len));
    if (maskKey) for (let i = 0; i < payload.length; i++) payload[i] ^= maskKey[i & 3];
    peer.buffer = buf.subarray(offset + len);

    // Anything at all is proof of life, a pong included. That is the point of
    // pinging: it keeps a deliberately silent client accounted for.
    peer.heard = Date.now();

    if (opcode === 0x8) { onClose(); return; }
    if (opcode === 0x9) peer.socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload]));
    if (opcode === 0x1) onText(payload.toString('utf8'));
  }
}

// --- the relay itself ------------------------------------------------------

function send(peer, message) {
  if (!peer.socket.destroyed) peer.socket.write(frame(JSON.stringify(message)));
}

function broadcast(from, message) {
  for (const peer of peers) if (peer !== from) send(peer, message);
}

function drop(peer) {
  if (!peers.delete(peer)) return;
  broadcast(peer, { type: 'gone', id: peer.id });
  peer.socket.destroy();
  console.log(`  left  ${peer.id ?? '(unannounced)'}  · ${peers.size} here`);
}

const server = createServer((_, res) => { res.writeHead(426); res.end('websocket only'); });

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) return socket.destroy();

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${createHash('sha1').update(key + GUID).digest('base64')}\r\n\r\n`
  );
  socket.setNoDelay(true);

  const peer = { socket, buffer: Buffer.alloc(0), id: null, last: null, heard: Date.now() };
  peers.add(peer);

  socket.on('data', (chunk) => {
    peer.buffer = Buffer.concat([peer.buffer, chunk]);
    drain(peer, (text) => {
      let message;
      try { message = JSON.parse(text); } catch { return; }
      if (!message || typeof message !== 'object') return;

      // Said goodbye on the way out. Tell the room straight away rather than
      // making everybody wait out a timeout.
      if (message.type === 'bye') { drop(peer); return; }

      if (message.type === 'state' && message.player) {
        const first = peer.id === null;
        peer.id = message.player.id;
        // Keep the latest state so somebody arriving later sees who is already
        // here, rather than waiting for everyone to move.
        peer.last = message.player;
        if (first) {
          console.log(`  joined ${peer.id} · ${peers.size} here`);
          for (const other of peers) {
            if (other !== peer && other.last) send(peer, { type: 'state', player: other.last });
          }
        }
        broadcast(peer, message);
      }
    }, () => drop(peer));
  });

  socket.on('error', () => drop(peer));
  socket.on('close', () => drop(peer));
});

// Ask the quiet ones whether they are still there, and show out only the ones
// that do not answer.
setInterval(() => {
  const now = Date.now();
  for (const peer of [...peers]) {
    const quiet = (now - peer.heard) / 1000;
    if (quiet > IDLE_SECONDS) {
      console.log(`  silent ${peer.id ?? '(unannounced)'} for ${Math.round(quiet)}s`);
      drop(peer);
    } else if (quiet > PING_AFTER_SECONDS && !peer.socket.destroyed) {
      peer.socket.write(Buffer.from([0x89, 0]));   // ping, no payload
    }
  }
}, SWEEP_SECONDS * 1000).unref();

// Almost always this means a relay is already running, which is good news
// wearing a frightening hat. Say so, rather than throwing a stack trace at
// somebody who has done nothing wrong.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} is already in use.`);
    console.error('  A relay is most likely already running in another window — look for');
    console.error(`  one saying "café relay -> ws://localhost:${PORT}", and use that one.`);
    console.error(`\n  To run a second one anyway: PORT=8002 npm run relay\n`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`\n  café relay  ->  ws://localhost:${PORT}`);
  console.log('  open the café in two browser windows.\n  Ctrl+C to stop.\n');
});

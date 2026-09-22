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

  const peer = { socket, buffer: Buffer.alloc(0), id: null, last: null };
  peers.add(peer);

  socket.on('data', (chunk) => {
    peer.buffer = Buffer.concat([peer.buffer, chunk]);
    drain(peer, (text) => {
      let message;
      try { message = JSON.parse(text); } catch { return; }
      if (!message || typeof message !== 'object') return;

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

server.listen(PORT, () => {
  console.log(`\n  café relay  ->  ws://localhost:${PORT}`);
  console.log('  open the café in two browser windows.\n  Ctrl+C to stop.\n');
});

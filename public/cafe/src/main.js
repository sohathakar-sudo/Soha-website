import { VIEW } from './config.js';
import { createLoop } from './loop.js';
import * as net from './net.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

canvas.width = VIEW.width;
canvas.height = VIEW.height;

// --- Integer scaling -------------------------------------------------------
// The backing store stays at native resolution. Only the CSS size changes, so
// every pixel is upscaled by a whole number and nothing ever blurs.
let scale = 1;

function resize() {
  const fitX = Math.floor(window.innerWidth / VIEW.width);
  const fitY = Math.floor(window.innerHeight / VIEW.height);
  scale = Math.max(1, Math.min(fitX, fitY, VIEW.maxScale));
  canvas.style.width = `${VIEW.width * scale}px`;
  canvas.style.height = `${VIEW.height * scale}px`;
  ctx.imageSmoothingEnabled = false;
}

window.addEventListener('resize', resize);
resize();

// --- Scaffold scene --------------------------------------------------------
// A single rectangle bouncing around the room, here only to prove that the
// fixed-timestep loop and the scaling maths are both correct. Phase 3 replaces
// it with real players.
const box = { x: 40, y: 60, w: 24, h: 16, vx: 70, vy: 45 };
let tick = 0;

function update(dt) {
  tick++;

  box.x += box.vx * dt;
  box.y += box.vy * dt;

  if (box.x < 0) { box.x = 0; box.vx = -box.vx; }
  if (box.y < 0) { box.y = 0; box.vy = -box.vy; }
  if (box.x + box.w > VIEW.width) { box.x = VIEW.width - box.w; box.vx = -box.vx; }
  if (box.y + box.h > VIEW.height) { box.y = VIEW.height - box.h; box.vy = -box.vy; }

  // Multiplayer hook: this is where the local input for the tick would go out.
  net.sendInput(null, tick);
}

function render() {
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = '#8c8c92';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  // Corner markers, so letterboxing and the integer scale are easy to eyeball.
  ctx.fillStyle = '#3a3a40';
  ctx.fillRect(0, 0, VIEW.width, 1);
  ctx.fillRect(0, VIEW.height - 1, VIEW.width, 1);
  ctx.fillRect(0, 0, 1, VIEW.height);
  ctx.fillRect(VIEW.width - 1, 0, 1, VIEW.height);

  ctx.fillStyle = '#111';
  ctx.fillRect(Math.round(box.x), Math.round(box.y), box.w, box.h);

  ctx.fillStyle = '#111';
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  ctx.fillText(`${VIEW.width}x${VIEW.height} @ ${scale}x  fps ${loop.stats.fps}`, 4, 4);
}

// Multiplayer hook: snapshots would be applied to room state here.
net.onSnapshot(() => {});
net.connect();

const loop = createLoop({ update, render });
loop.start();

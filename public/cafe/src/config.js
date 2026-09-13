// All tunables live here. Nothing else should hardcode a number that belongs in this file.

export const VIEW = {
  width: 480,
  height: 270,
  maxScale: 8,
  mobileBreakpoint: 700,
};

export const LOOP = {
  // Fixed-timestep simulation: 60 updates per second.
  tickHz: 60,
  // Never simulate more than this much wall time in one frame (tab-out protection).
  maxFrameSeconds: 0.25,
};

export const PLAYER = {
  speed: 60, // pixels per second
  // Collision box sits at the sprite's feet, not around the whole 32x32 frame.
  hitbox: { w: 16, h: 8 },
  sprite: { w: 32, h: 32 },
  // Where the player's (x, y) sits inside the 32x32 frame: centred, on the
  // ground the dot stands on.
  anchor: { x: 16, y: 28 },
};

// Sprite sheets are 4 columns x 6 rows of 32x32 frames (128x192 PNG).
export const SHEET = {
  frameWidth: 32,
  frameHeight: 32,
  cols: 4,
  rows: 6,
};

// Animation table as data. Draw code reads this; it never hardcodes rows.
export const ANIMATIONS = {
  'walk-down':  { row: 0, frames: 4, fps: 8, loop: true },
  'walk-up':    { row: 1, frames: 4, fps: 8, loop: true },
  'walk-left':  { row: 2, frames: 4, fps: 8, loop: true },
  'walk-right': { row: 3, frames: 4, fps: 8, loop: true },
  // Row 4 holds one sit frame per facing, in this column order.
  'sit':        { row: 4, frames: 4, fps: 0, loop: false, byDir: ['down', 'up', 'left', 'right'] },
  'work':       { row: 5, frames: 2, fps: 4, loop: true },
};

export const DIRECTIONS = ['down', 'up', 'left', 'right'];

export const CATS = ['cat-01', 'cat-02', 'cat-03', 'cat-04', 'cat-05', 'cat-06', 'cat-07', 'cat-08'];

export const PATHS = {
  assets: './assets/',
  room: './data/room.json',
};

export const DEBUG = {
  toggleKey: 'Backquote',
};

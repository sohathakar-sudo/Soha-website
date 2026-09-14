// All tunables live here. Nothing else should hardcode a number that belongs in this file.

export const VIEW = {
  // Raised from 480x270: the room has to hold twelve people and let them run.
  width: 640,
  height: 360,
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
  // (x, y) is the ground point: the spot on the floor the player occupies.
  // Collision, y-sorting and seat snapping all use it.
  hitbox: { w: 16, h: 8 },
  sprite: { w: 32, h: 32 },
  anchor: { x: 16, y: 28 },
};

// Eight faces, one 32x32 PNG each, indexed by faceId 1-8.
export const FACE_COUNT = 8;

export function faceFile(faceId) {
  return 'face-' + String(faceId).padStart(2, '0') + '.png';
}

// The room's three colours. Shadows are warm dark at low alpha, never black:
// black on cream reads as a hole.
export const PALETTE = {
  cream: '#f0e6d6',
  creamShade: '#e4d7c3',
  charcoal: '#33302c',
  red: '#c2493d',
  shadow: 'rgba(60, 44, 32, 0.28)',
};

export const CATS = ['cat-01', 'cat-02', 'cat-03', 'cat-04', 'cat-05', 'cat-06', 'cat-07', 'cat-08'];

export const PATHS = {
  assets: './assets/',
  room: './data/room.json',
};

export const DEBUG = {
  toggleKey: 'Backquote',
};

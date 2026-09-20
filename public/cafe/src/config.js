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
};

// How a person is drawn. Every number the faces need lives here.
export const FACE = {
  size: 32,       // the PNG, drawn 1:1
  hover: 14,      // face centre above the ground point
  bobAmount: 2,   // peak of the walk bob; the bob itself lands next phase
  shadow: {
    w: 16,
    h: 5,
    // Warm dark, never pure black: black on cream reads as a hole.
    color: '#3c2c20',
    alpha: 0.28,
    shrink: 0.25,  // how much the shadow tightens at the top of the bob
    fade: 0.35,    // and how much it fades
  },
};

// One 32x32 PNG per face, indexed by faceId. Raise this the moment more
// drawings land in assets/ — nothing else needs to change.
export const FACE_COUNT = 5;

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

export const PATHS = {
  assets: './assets/',
  room: './data/room.json',
};

export const DEBUG = {
  toggleKey: 'Backquote',
};

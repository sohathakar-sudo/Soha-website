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

// A coffee is a thing with a lifetime, not a number that only goes up.
export const COFFEE = {
  // Seconds a cup is good for, from the moment it is bought. It counts down
  // whether you are sitting or not — it is going cold while you are up at the
  // counter too.
  lasts: 120,
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

  // The bob is driven by distance walked, not by the clock, so it cannot drift
  // out of step with speed however fast anyone moves.
  bobAmount: 2,        // peak height, in pixels
  bobPeriodPx: 18,     // pixels of travel per complete up-and-down
  settleSeconds: 0.2,  // how long the bob takes to fade in and out
  // Someone arriving through snapshots moves in bursts — a step on one tick,
  // nothing for the next few — so a player keeps counting as walking for a
  // moment after their last movement. Long enough to bridge the gap between
  // snapshots, short enough that stopping still feels immediate.
  coastSeconds: 0.1,
  // A move longer than this in one tick is a teleport, not a stride.
  maxStepPx: 24,
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

// --- Sound -----------------------------------------------------------------
// There is no in-game volume or mute control on purpose: the operating system
// and the browser's own tab mute already do that job, and better. This block is
// the mix, not a user setting.
export const AUDIO = {
  // Everything is scaled by this. The café should sit under a conversation,
  // never over one.
  masterVolume: 0.5,

  // One-shots, relative to master.
  volume: {
    click: 0.35,
    pick: 0.30,
    door: 0.45,
    step: 0.16,
    sit: 0.28,
    stand: 0.24,
    coffee: 0.40,
    doorOpen: 0.34,
    doorClose: 0.32,
    // Scribbling and sipping are narrow, soft and short, and they play over the
    // top of the jukebox rather than in a gap. Their peak level was already
    // fine; what they lacked was presence against a continuous loop.
    scribble: 0.34,
    type: 0.26,
    sip: 0.40,
    cutlery: 0.30,
  },

  // Working at a table. `settle` is the wait before the FIRST one after sitting
  // down — somebody who starts typing the instant they land reads as a machine
  // rather than as a person getting their things out — and `every` is the gap
  // between the ones after that.
  //
  // Both were originally much longer, which made them effectively invisible:
  // settle plus the first interval came to nine seconds before you heard
  // anything, and nobody sits still that long wondering whether a feature
  // works. A sound nobody waits around for is a sound that does not exist.
  desk: {
    every: { min: 2.5, max: 6 },
    settle: { min: 0.7, max: 1.6 },
  },

  // Drinking it. Only ever at a table, so standing up ends it and sitting back
  // down with the same cup picks it up again. Same fix, more severe: the first
  // sip used to be up to thirty-eight seconds away.
  sipping: {
    every: { min: 8, max: 18 },
    settle: { min: 1.5, max: 3.5 },
    // How often a sip is instead the cup meeting its saucer.
    cutleryChance: 0.25,
  },

  // Doorways that creak when someone goes through them. Like the garden
  // emitter, these are written down rather than read off room.json: the layout
  // colour key has no colour for a door, so the importer has nothing to emit.
  // The gap they describe is real geometry — the dividing wall runs y 128-344,
  // leaving the top of it open — and the rectangle is made a little wider than
  // the gap so that walking through it always registers.
  doors: [
    { id: 'garden', x: 478, y: 48, w: 24, h: 80 },
  ],

  // Footsteps are not timed at all: one plays every time the bob completes a
  // cycle, so a footfall lands exactly when the face touches down. The cadence
  // is therefore FACE.bobPeriodPx and there is nothing here to keep in sync
  // with it.

  // Somebody else's footstep, sit or coffee is heard from where you are
  // standing. The local player is always at full volume — you are not across
  // the room from yourself.
  nearby: { near: 40, far: 280 },

  // Looped ambience.
  //
  // A space has one volume throughout. A café does not get quieter because you
  // walked to the counter, so there is no distance falloff inside a room and no
  // emitter to measure from — only which side of the dividing wall you are on.
  // `space` says where a loop belongs; `throughDoor` is the ceiling on what
  // reaches the other side, measured from the doorway, since the opening is the
  // only route sound has through eight pixels of solid wall.
  ambience: {
    roomTone: { volume: 0.10 },
    music:    { volume: 0.30, space: 'cafe',   throughDoor: { near: 24, far: 90 } },
    garden:   { volume: 0.26, space: 'garden', throughDoor: { near: 24, far: 90 } },
  },

  // A backgrounded tab is throttled and nobody is listening to it anyway.
  suspendWhenHidden: true,
};

export const PATHS = {
  assets: './assets/',
  audio: './assets/audio/',
  room: './data/room.json',
};

export const DEBUG = {
  toggleKey: 'Backquote',
};

// All tunables live here. Nothing else should hardcode a number that belongs in this file.

export const VIEW = {
  // Raised from 480x270: the room has to hold twelve people and let them run.
  width: 640,
  height: 360,
  maxScale: 8,
  mobileBreakpoint: 700,
  // Below this device pixel ratio the game scales by whole numbers only and
  // letterboxes whatever is left over, because a fractional scale on a 1x
  // screen puts some pixels two across and others three, and on 2px line work
  // that is glaring. At 2x and above there are enough device pixels underneath
  // that the unevenness stops being visible, so the picture is allowed to fill
  // the window instead. Raise this above 2 to go back to whole numbers
  // everywhere.
  fluidMinDpr: 2,
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
    register: 0.38,
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

  // The café keeps playing when you switch tabs. That is the whole point of it:
  // you put it on and go and work somewhere else, and the room is still there.
  //
  // It costs something. A hidden tab stops painting frames, so the loops cannot
  // be scheduled off the game's tick any more — see the scheduler in
  // ambience.js, which runs on its own timer and books further ahead than a
  // throttled background timer can fall behind.
  suspendWhenHidden: false,
};

// The wire. See MULTIPLAYER.md.
export const NET = {
  // Where the relay is. null means offline, which is the correct default: a
  // café deployed to a real site must not go looking for a server nobody set
  // up. Set it here, or drop a url into localStorage under 'cafe:relay'.
  url: null,
  // On localhost, assume `npm run relay` and connect without being asked.
  devPort: 8001,

  // A position change smaller than this is not news. Movement is continuous
  // and the wire is not; without a floor, standing still would still trickle.
  moveEpsilon: 1.5,
  // Walking is continuous, so without a ceiling it would send on nearly every
  // tick. Ten a second is more than enough to interpolate between and is the
  // difference between affordable and not.
  maxMovesPerSecond: 10,
  // Even with nothing happening, say so occasionally — it is how the other end
  // knows the difference between still and gone.
  heartbeatSeconds: 15,

  // Alone in an empty room, say nothing at all.
  //
  // The heartbeat exists so other people know you have not vanished. With
  // nobody else here there is nobody to tell, so it is pure cost — and being
  // alone is the state this café will spend most of its life in.
  //
  // Waking needs no poll and no reconnection, because the connection stays
  // open: somebody else arriving is a message, and hearing it is what wakes us.
  // Connections are free on the tiers this is aimed at. Messages are not.
  dormantAfterSeconds: 300,

  // Who is still here.
  //
  // A clean departure says so. Everything else — a shut laptop, dropped wifi, a
  // crashed tab — says nothing at all, and the socket can stay half-open for
  // minutes. So silence has to be a signal too, and the heartbeat above is what
  // makes silence mean something.
  presence: {
    // No word for this long and they have gone. Three times the heartbeat, so
    // two can go missing without anybody being wrongly shown the door.
    timeoutSeconds: 45,
    sweepSeconds: 5,
  },

  // A dropped connection that never comes back is the same as being alone, and
  // it does not announce itself. Try again, backing off so a relay that is down
  // is not also being hammered.
  reconnect: {
    firstDelaySeconds: 1,
    maxDelaySeconds: 30,
  },

  // Messages land a few times a second; frames happen sixty times a second.
  // Without this, everybody else stands still and then jumps.
  smoothing: {
    // Roughly how long to close the gap. A time constant rather than a speed,
    // so arriving settles instead of overshooting and coming back.
    seconds: 0.12,
    // Close enough. Without a floor it approaches forever, never quite lands,
    // and nobody is ever judged to be standing still.
    arriveWithin: 0.4,
    // Further than this was not a walk. Sitting down snaps you onto a seat, and
    // that should land rather than glide across the room. Same idea as
    // FACE.maxStepPx, which tells the bob the difference between a stride and a
    // teleport.
    teleportOver: 56,
  },
};

export const PATHS = {
  assets: './assets/',
  props: './assets/props/',
  audio: './assets/audio/',
  room: './data/room.json',
};

export const DEBUG = {
  toggleKey: 'Backquote',
};

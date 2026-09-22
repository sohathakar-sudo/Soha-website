import { AUDIO } from './config.js';

// The mixer: one AudioContext, one master gain, and the rule that nothing makes
// a sound until the player has interacted with the page.
//
// There is no mute control here. The operating system has a volume key and the
// browser has a tab mute, and both are better than anything this file could
// offer. What this file owns is the mix and the lifecycle.
//
// Browsers refuse to start an AudioContext outside a user gesture, so the
// context is not merely suspended before the first click — it does not exist.
// That is also the strongest possible guarantee against the autoplay bug this
// project has already hit once.

let ctx = null;
let master = null;

// True once the player has clicked something and the context is running.
export function isReady() {
  return ctx !== null && ctx.state === 'running';
}

export function context() {
  return ctx;
}

// The node every sound connects to. Null until unlock() has been called.
export function bus() {
  return master;
}

export function now() {
  return ctx ? ctx.currentTime : 0;
}

// Call this from inside a real user gesture — a click or a keypress handler.
// Safe to call repeatedly; only the first call builds anything.
export function unlock() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    // No Web Audio at all. Everything downstream checks bus() and no-ops.
    if (!Ctor) return false;
    try {
      ctx = new Ctor();
    } catch {
      return false;
    }
    master = ctx.createGain();
    master.gain.value = AUDIO.masterVolume;
    master.connect(ctx.destination);
  }

  // Created inside a gesture a context usually starts running, but Safari and a
  // page restored from the back/forward cache both hand one back suspended.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return true;
}

// A backgrounded tab gets its timers throttled and has nobody listening to it.
// Suspending is both politer and cheaper than letting the loops run on.
if (AUDIO.suspendWhenHidden) {
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  });
}

// --- Positional volume -----------------------------------------------------
// Full volume within `near`, silent beyond `far`, smooth in between. Pure: two
// points and two radii in, a number out. Used for the jukebox and the garden,
// which sit at opposite ends of a 640px-wide room.
export function gainFor(emitter, x, y, near, far) {
  const dx = x - emitter.x;
  const dy = y - emitter.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance <= near) return 1;
  if (distance >= far) return 0;

  const t = (distance - near) / (far - near);
  // Smoothstep rather than a straight line: a linear fade is audible as a ramp,
  // this one just feels like walking away from something.
  return 1 - t * t * (3 - 2 * t);
}

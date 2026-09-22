import { AUDIO, PATHS } from './config.js';
import { context, bus } from './audio.js';

// Every one-shot the café makes.
//
// No audio files ship with the project. Each sound is a short recipe built out
// of oscillators and noise at the moment it plays — a few hundred bytes of code
// instead of a few hundred kilobytes of samples, and no dependency, no build
// step and nothing to license. This is the same move the room art makes with
// tools/make-placeholders.html: something real to work against now, replaced by
// the drawn version later.
//
// To replace one with a recording: drop assets/audio/<name>.mp3 in and add its
// name to assets/audio/manifest.json. Nothing in this file changes.

// --- Noise -----------------------------------------------------------------
// One second of white noise, made once and re-read at different speeds and
// through different filters. Almost everything percussive here is filtered
// noise: a footstep, a cup, a door.
let noise = null;

function noiseBuffer(ctx) {
  if (noise) return noise;
  const frames = ctx.sampleRate;
  noise = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  return noise;
}

// An envelope that opens fast and falls away. exponentialRamp cannot reach zero,
// hence the floor.
const FLOOR = 0.0001;

function envelope(ctx, peak, attack, decay, at) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(FLOOR, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, FLOOR), at + attack);
  gain.gain.exponentialRampToValueAtTime(FLOOR, at + attack + decay);
  return gain;
}

function burst(ctx, out, { freq, type = 'bandpass', q = 1, peak, attack, decay, at, sweepTo }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(freq, at);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, at + attack + decay);
  filter.Q.value = q;

  const env = envelope(ctx, peak, attack, decay, at);
  src.connect(filter).connect(env).connect(out);
  src.start(at);
  src.stop(at + attack + decay + 0.02);
}

function tone(ctx, out, { freq, type = 'sine', peak, attack, decay, at, glideTo }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, at + attack + decay);

  const env = envelope(ctx, peak, attack, decay, at);
  osc.connect(env).connect(out);
  osc.start(at);
  osc.stop(at + attack + decay + 0.02);
}

// A creak. Noise through a very narrow bandpass, with the centre frequency
// sliding as the door swings — and wobbling as it slides, because a hinge does
// not turn smoothly. That wobble is the whole difference between wood and a
// whistle.
function creak(ctx, out, { from, to, peak, duration, at, wobble = 10 }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;

  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 22;
  band.frequency.setValueAtTime(from, at);
  band.frequency.linearRampToValueAtTime(to, at + duration);

  const lfo = ctx.createOscillator();
  lfo.type = 'triangle';
  lfo.frequency.value = wobble;
  const depth = ctx.createGain();
  depth.gain.value = from * 0.2;
  lfo.connect(depth).connect(band.frequency);
  lfo.start(at);
  lfo.stop(at + duration + 0.05);

  const env = envelope(ctx, peak, 0.03, duration, at);
  src.connect(band).connect(env).connect(out);
  src.start(at);
  src.stop(at + duration + 0.06);
}

// A little variation, so a run of footsteps doesn't sound like a machine.
const vary = (value, amount) => value * (1 + (Math.random() * 2 - 1) * amount);

// --- The recipes -----------------------------------------------------------
// One entry per sound. Each gets the context, the node to connect to, and the
// time to start at.
const RECIPES = {
  // A dry tick. Deliberately unmusical — it is feedback, not a note.
  click(ctx, out, at) {
    burst(ctx, out, { freq: 1900, q: 1.1, peak: 1, attack: 0.002, decay: 0.045, at });
  },

  // The same tick, lighter and higher: picking a face is a smaller act than
  // pressing Play.
  pick(ctx, out, at) {
    burst(ctx, out, { freq: 2800, q: 1.4, peak: 1, attack: 0.002, decay: 0.035, at });
    tone(ctx, out, { freq: 1320, peak: 0.25, attack: 0.003, decay: 0.07, at });
  },

  // A shop doorbell: two partials, struck twice, the second softer. This is the
  // one moment of arrival the café has, so it is allowed to ring.
  door(ctx, out, at) {
    for (const [offset, level] of [[0, 1], [0.13, 0.6]]) {
      tone(ctx, out, { freq: 1180, peak: 0.5 * level, attack: 0.004, decay: 0.55, at: at + offset });
      tone(ctx, out, { freq: 1567, peak: 0.35 * level, attack: 0.004, decay: 0.42, at: at + offset });
      tone(ctx, out, { freq: 2360, peak: 0.12 * level, attack: 0.004, decay: 0.25, at: at + offset });
    }
  },

  // Soft, low, and slightly different every time.
  step(ctx, out, at) {
    burst(ctx, out, {
      freq: vary(500, 0.22), type: 'lowpass', q: 0.8,
      peak: vary(1, 0.25), attack: 0.003, decay: 0.07, at,
    });
  },

  // Weight going down: a dull thud with a chair's creak under it.
  sit(ctx, out, at) {
    burst(ctx, out, { freq: 260, type: 'lowpass', q: 0.7, peak: 1, attack: 0.005, decay: 0.16, at });
    tone(ctx, out, { freq: 120, peak: 0.3, attack: 0.01, decay: 0.2, at, glideTo: 80 });
  },

  // Weight coming off: shorter, and rising where sitting falls.
  stand(ctx, out, at) {
    burst(ctx, out, { freq: 380, type: 'lowpass', q: 0.7, peak: 0.8, attack: 0.004, decay: 0.1, at });
    tone(ctx, out, { freq: 90, peak: 0.22, attack: 0.008, decay: 0.14, at, glideTo: 150 });
  },

  // The latch letting go, then the swing. Rising, because it is opening.
  doorOpen(ctx, out, at) {
    burst(ctx, out, { freq: 2200, q: 3, peak: 0.35, attack: 0.002, decay: 0.03, at });
    burst(ctx, out, { freq: 180, type: 'lowpass', q: 0.7, peak: 0.3, attack: 0.02, decay: 0.3, at: at + 0.02 });
    creak(ctx, out, { from: 300, to: 520, peak: 0.55, duration: 0.42, at: at + 0.04, wobble: 11 });
  },

  // The same hinge going the other way, and then the door actually arriving:
  // the frame first, the latch a moment behind it.
  doorClose(ctx, out, at) {
    creak(ctx, out, { from: 500, to: 310, peak: 0.4, duration: 0.3, at, wobble: 8 });
    burst(ctx, out, { freq: 150, type: 'lowpass', q: 0.8, peak: 0.9, attack: 0.004, decay: 0.16, at: at + 0.32 });
    burst(ctx, out, { freq: 2600, q: 4, peak: 0.3, attack: 0.002, decay: 0.035, at: at + 0.35 });
  },

  // A pour that climbs as the cup fills, then the cup set down on the counter.
  coffee(ctx, out, at) {
    burst(ctx, out, {
      freq: 900, sweepTo: 1900, q: 2.2,
      peak: 0.7, attack: 0.05, decay: 0.5, at,
    });
    tone(ctx, out, { freq: 2100, peak: 0.3, attack: 0.002, decay: 0.12, at: at + 0.56 });
    tone(ctx, out, { freq: 3150, peak: 0.12, attack: 0.002, decay: 0.09, at: at + 0.56 });
  },
};

// --- Recorded overrides ----------------------------------------------------
// assets/audio/manifest.json lists the sounds that have a real file behind them.
// It ships listing none, so there is exactly one fetch at startup and never a
// missing-file error in the console.
const buffers = new Map();

export async function preload() {
  const ctx = context();
  if (!ctx) return;

  let names = [];
  try {
    const res = await fetch(PATHS.audio + 'manifest.json', { cache: 'no-store' });
    if (res.ok) names = (await res.json()).files || [];
  } catch {
    /* no manifest is the normal case; everything stays synthesized */
  }

  await Promise.all(names.map(async (name) => {
    try {
      const res = await fetch(PATHS.audio + name + '.mp3');
      if (!res.ok) return;
      buffers.set(name, await ctx.decodeAudioData(await res.arrayBuffer()));
    } catch {
      /* a bad file falls back to the synthesized version rather than silence */
    }
  }));
}

// --- Playing ---------------------------------------------------------------
// `gain` is an extra multiplier on top of the sound's configured volume, for
// callers that want one quieter than another — a footstep across the room, say.
// `delay` schedules it that many seconds out, which is how a door opens, a bell
// rings and the door closes again as one arrival rather than three noises.
export function play(name, gain = 1, delay = 0) {
  // No bus means audio has never been unlocked, so there is nothing to play
  // into. A context that exists but is still resuming is fine: whatever gets
  // scheduled now sounds the moment it starts running.
  if (!bus()) return;

  const ctx = context();
  const out = ctx.createGain();
  out.gain.value = (AUDIO.volume[name] ?? 0.3) * gain;
  out.connect(bus());

  const at = ctx.currentTime + delay;
  const recorded = buffers.get(name);

  if (recorded) {
    const src = ctx.createBufferSource();
    src.buffer = recorded;
    src.connect(out);
    src.start(at);
    return;
  }

  const recipe = RECIPES[name];
  if (recipe) recipe(ctx, out, at);
}

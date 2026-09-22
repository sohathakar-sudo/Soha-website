import { AUDIO } from './config.js';
import { context, bus, gainFor } from './audio.js';

// The three things the café is always doing: humming to itself, playing
// something on the jukebox, and letting the garden in through the doorway.
//
// The one-shots in sounds.js are events. These are places, and a place has one
// volume throughout — the music does not get quieter because you walked to the
// counter. What separates them is the dividing wall: the café and the garden
// are two rooms, each flat inside itself, each audible from the other only
// through the one doorway. The room tone underneath belongs to neither and
// never moves; it is the floor that stops an empty café sounding broken.
//
// Everything here is generated too, for the same reasons as sounds.js: no
// files, no dependency, and nothing to license. Real music is a decision about
// taste and rights, not a decision about code, and it can arrive later without
// this file changing.

let started = false;
let pump = null;
const loops = {};

// --- Shared noise ----------------------------------------------------------
// Four seconds is long enough that the loop point is not audible as a pulse.
function noiseLoop(ctx, seconds, brown) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      // Integrated white noise: much more weight low down, which is what a
      // room full of people and a fridge actually sounds like.
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }

  // Cross-fade the last tenth of a second into the first, so the seam is gone.
  const blend = Math.floor(ctx.sampleRate * 0.1);
  for (let i = 0; i < blend; i++) {
    const t = i / blend;
    data[i] = data[i] * t + data[data.length - blend + i] * (1 - t);
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

// A loop is a source, a filter chain and a gain we can ride.
function createLoop(ctx, build) {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(bus());
  build(ctx, gain);
  return {
    gain,
    // setTargetAtTime rather than a jump: walking away from the jukebox should
    // sound like walking away, not like someone turning it off.
    to(level) {
      gain.gain.setTargetAtTime(level, ctx.currentTime, 0.12);
    },
  };
}

// --- Room tone -------------------------------------------------------------
function buildRoomTone(ctx, out) {
  const source = noiseLoop(ctx, 4, true);

  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 420;

  // Without this the brown noise is mostly inaudible rumble that some speakers
  // reproduce as a thump and others not at all.
  const high = ctx.createBiquadFilter();
  high.type = 'highpass';
  high.frequency.value = 90;

  source.connect(low).connect(high).connect(out);
  source.start();
}

// --- Garden ----------------------------------------------------------------
// Leaves, plus birds that do not keep time. A chirp on a fixed interval stops
// sounding like a bird within about thirty seconds.
function buildGarden(ctx, out) {
  const leaves = noiseLoop(ctx, 4, false);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 2600;
  band.Q.value = 0.6;
  const quiet = ctx.createGain();
  quiet.gain.value = 0.05;
  leaves.connect(band).connect(quiet).connect(out);
  leaves.start();
}

function chirp(ctx, out, at) {
  // Two to four notes, each a quick upward sweep. Same bird, different mood.
  const notes = 2 + Math.floor(Math.random() * 3);
  const base = 2400 + Math.random() * 1400;

  for (let i = 0; i < notes; i++) {
    const start = at + i * (0.055 + Math.random() * 0.04);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.2), start);
    osc.frequency.exponentialRampToValueAtTime(base * 1.35, start + 0.05);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(0.35, start + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, start + 0.06);

    osc.connect(env).connect(out);
    osc.start(start);
    osc.stop(start + 0.09);
  }
}

// --- Jukebox ---------------------------------------------------------------
// A slow four-chord loop, arpeggiated, each note a soft plucked triangle. Warm
// rather than clever: it has to survive being heard for an hour.
const BEAT = 60 / 68;           // seconds; 68bpm, slower than a heartbeat
const CHORDS = [                // MIDI notes: Fmaj7 · Am7 · Dm7 · Cmaj7
  [53, 60, 64, 69],
  [57, 60, 64, 67],
  [50, 57, 62, 65],
  [48, 55, 60, 64],
];

const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

function pluck(ctx, out, midi, at, level) {
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = hz(midi);

  // Rolling the top off as the note decays is what makes it read as plucked
  // rather than as a synthesizer holding a triangle wave.
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.setValueAtTime(2600, at);
  tone.frequency.exponentialRampToValueAtTime(700, at + 1.4);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(level, at + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, at + 1.6);

  osc.connect(tone).connect(env).connect(out);
  osc.start(at);
  osc.stop(at + 1.7);
}

function buildMusic() {
  // Nothing to build up front — the notes are scheduled as they come round.
}

// --- The scheduler ---------------------------------------------------------
// Both the birds and the music are events in the future rather than a loop
// playing, so they need a clock. It is the game's tick, not a timer of their
// own: one place deciding when things happen, and a backgrounded tab that stops
// ticking stops scheduling instead of queueing up a minute of birdsong.
// Seconds of music booked in advance. This is generous on purpose: a hidden
// tab has its timers throttled to roughly one call a second, so the buffer has
// to be comfortably longer than that or the music gaps every time you look
// away — which is exactly when it matters most.
const LOOKAHEAD = 2.5;
const PUMP_MS = 700;

const clock = { nextChirp: 0, nextNote: 0, beat: 0 };

function scheduleAhead(ctx) {
  const horizon = ctx.currentTime + LOOKAHEAD;

  // If the timer was starved — a tab asleep for a long stretch, a machine that
  // suspended — the clock can be minutes behind. Catch it up rather than
  // scheduling every note it missed all at once.
  if (clock.nextNote < ctx.currentTime - 1) {
    const missed = Math.ceil((ctx.currentTime - clock.nextNote) / BEAT);
    clock.nextNote += missed * BEAT;
    clock.beat += missed;
  }
  if (clock.nextChirp < ctx.currentTime - 1) clock.nextChirp = ctx.currentTime + 1;

  while (clock.nextNote < horizon) {
    const chord = CHORDS[Math.floor(clock.beat / 4) % CHORDS.length];
    const step = clock.beat % 4;

    // Root on the downbeat, then up through the chord. The root an octave down
    // every other bar keeps it from sitting in one narrow band.
    if (step === 0) pluck(ctx, loops.music.gain, chord[0] - 12, clock.nextNote, 0.16);
    pluck(ctx, loops.music.gain, chord[step], clock.nextNote, step === 0 ? 0.13 : 0.1);

    clock.beat++;
    clock.nextNote += BEAT;
  }

  while (clock.nextChirp < horizon) {
    chirp(ctx, loops.garden.gain, clock.nextChirp);
    clock.nextChirp += 1.6 + Math.random() * 4.5;
  }
}

// --- Public --------------------------------------------------------------

// The garden doorway, as a point. The doors are listed for their creak, but the
// gap they describe is also the only hole in the dividing wall, which makes it
// the only route sound has into the café.
function doorway(id) {
  const door = (AUDIO.doors || []).find((d) => d.id === id);
  return door ? { x: door.x + door.w / 2, y: door.y + door.h / 2 } : null;
}

// What a loop is worth from where the listener is standing.
//
// Inside its own space, everything: a room has one volume, and walking to the
// counter does not turn the music down. From the other side of the dividing
// wall, only what fits through the doorway — which is a ceiling rather than a
// second source, so nothing is ever louder than the hole it came through.
//
// The two meet at the opening. Standing in the doorway the ceiling is 1, which
// is also what the same-space term gives, so crossing the threshold in either
// direction is a fade and never a step.
function spaceGain(listener, space, throughDoor) {
  const door = doorway('garden');
  if (!door || !throughDoor) return 1;

  const listenerInGarden = listener.x >= door.x;
  if (listenerInGarden === (space === 'garden')) return 1;

  return gainFor(door, listener.x, listener.y, throughDoor.near, throughDoor.far);
}

export function start() {
  const ctx = context();
  if (started || !ctx || !bus()) return;
  started = true;

  loops.roomTone = createLoop(ctx, buildRoomTone);
  loops.garden = createLoop(ctx, buildGarden);
  loops.music = createLoop(ctx, buildMusic);

  loops.roomTone.to(AUDIO.ambience.roomTone.volume);

  clock.nextNote = ctx.currentTime + 0.1;
  clock.nextChirp = ctx.currentTime + 1;
  clock.beat = 0;

  // The scheduler runs on its own timer rather than on the game's tick. The
  // tick is driven by animation frames, and a tab you have switched away from
  // stops painting — which would stop the music at the moment the café is most
  // useful. This keeps booking notes regardless.
  clearInterval(pump);
  pump = setInterval(() => scheduleAhead(ctx), PUMP_MS);
  scheduleAhead(ctx);
}

// What each loop is currently sitting at. For the console and the debug editor:
// positional audio is otherwise impossible to check without ears.
export function levels() {
  if (!started) return null;
  return {
    roomTone: loops.roomTone.gain.gain.value,
    music: loops.music.gain.gain.value,
    garden: loops.garden.gain.gain.value,
  };
}

// Called once per tick with wherever the player is standing.
export function update(listener, musicOn = true) {
  const ctx = context();
  if (!started || !ctx) return;

  const music = AUDIO.ambience.music;
  const garden = AUDIO.ambience.garden;

  loops.music.to(musicOn ? music.volume * spaceGain(listener, music.space, music.throughDoor) : 0);
  loops.garden.to(garden.volume * spaceGain(listener, garden.space, garden.throughDoor));
}

import { LOOP } from './config.js';

// Fixed-timestep loop with a render callback.
// update(dt) always sees the same dt, so simulation is deterministic and can be
// replayed server-side later. render(alpha) gets the leftover interpolation factor.
export function createLoop({ update, render }) {
  const step = 1 / LOOP.tickHz;
  let rafId = null;
  let last = 0;
  let accumulator = 0;
  let running = false;

  // Render-only stats. Kept out of room state on purpose.
  const stats = { fps: 0, frames: 0, fpsClock: 0 };

  function frame(now) {
    rafId = requestAnimationFrame(frame);

    let elapsed = (now - last) / 1000;
    last = now;
    if (!Number.isFinite(elapsed) || elapsed < 0) elapsed = 0;
    if (elapsed > LOOP.maxFrameSeconds) elapsed = LOOP.maxFrameSeconds;

    accumulator += elapsed;
    while (accumulator >= step) {
      update(step);
      accumulator -= step;
    }

    stats.frames++;
    stats.fpsClock += elapsed;
    if (stats.fpsClock >= 0.5) {
      stats.fps = Math.round(stats.frames / stats.fpsClock);
      stats.frames = 0;
      stats.fpsClock = 0;
    }

    render(accumulator / step);
  }

  return {
    stats,
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      accumulator = 0;
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(rafId);
      rafId = null;
    },
    get running() {
      return running;
    },
  };
}

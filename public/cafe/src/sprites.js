import { PATHS } from './config.js';

const cache = new Map();

export function loadImage(src) {
  if (cache.has(src)) return cache.get(src);
  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load ' + src));
    img.src = src;
  });
  cache.set(src, promise);
  return promise;
}

export function loadCatSheet(catId) {
  return loadImage(PATHS.assets + catId + '.png');
}

// Render state, kept apart from the player itself, and created lazily so a
// player who appears mid-session gets one. The bob lands in a later phase.
export function createRenderState() {
  return {};
}

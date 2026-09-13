import { SHEET, ANIMATIONS, PATHS } from './config.js';

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

// Which animation a player's state and facing map to. Data in config decides the
// rows; nothing here or in the draw call knows a row number.
export function animationFor(state, dir) {
  if (state === 'sitting') return 'sit';
  if (state === 'working') return 'work';
  return 'walk-' + dir;
}

// Render state, kept apart from the player itself: a timer per player that the
// room simulation neither reads nor needs.
export function createRenderState() {
  return { animTime: 0, animKey: '' };
}

export function advanceAnimation(renderState, state, dir, dt) {
  const key = animationFor(state, dir);
  if (key !== renderState.animKey) {
    // Restarting on a change keeps every walk beginning on the contact frame.
    renderState.animKey = key;
    renderState.animTime = 0;
    return;
  }
  if (state === 'idle') {
    renderState.animTime = 0; // idle holds frame 0
    return;
  }
  renderState.animTime += dt;
}

// Where in the sheet to cut the current frame from.
export function frameRect(state, dir, renderState) {
  const key = animationFor(state, dir);
  const anim = ANIMATIONS[key];

  let col = 0;
  if (anim.byDir) {
    // One frame per facing, e.g. the sit row.
    col = Math.max(0, anim.byDir.indexOf(dir));
  } else if (anim.fps > 0 && state !== 'idle') {
    col = Math.floor(renderState.animTime * anim.fps) % anim.frames;
  }

  return {
    sx: col * SHEET.frameWidth,
    sy: anim.row * SHEET.frameHeight,
    sw: SHEET.frameWidth,
    sh: SHEET.frameHeight,
  };
}

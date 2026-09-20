import { PATHS, FACE, FACE_COUNT, faceFile } from './config.js';

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

// All eight faces, loaded once and held in one array indexed by faceId. Never
// keyed by player: someone changing face between snapshots has to just work,
// and a per-player cache is exactly how that broke before.
const faces = [];

export async function loadFaces() {
  const loaded = await Promise.all(
    Array.from({ length: FACE_COUNT }, (_, i) => loadImage(PATHS.assets + faceFile(i + 1)).catch(() => null)),
  );
  faces.length = 0;
  faces.push(...loaded);
  return faces;
}

export function faceImage(faceId) {
  const index = Math.min(Math.max(Math.round(faceId) || 1, 1), FACE_COUNT) - 1;
  return faces[index] || null;
}

// Render state, kept apart from the player itself, and created lazily so a
// player appearing mid-session gets one. The bob lands in the next phase.
export function createRenderState() {
  return { bob: 0 };
}

// A person is drawn in two pieces: the shadow on the floor, then the face
// floating above it. The shadow is what puts them in the room rather than on
// the glass, so it stays even when the face is perfectly still.
export function drawShadow(ctx, x, y, bob = 0) {
  // As the face rises the shadow tightens and fades, the way a real one does.
  const rise = Math.abs(bob) / Math.max(1, FACE.bobAmount);
  const w = FACE.shadow.w * (1 - rise * FACE.shadow.shrink);
  const h = FACE.shadow.h * (1 - rise * FACE.shadow.shrink);

  ctx.save();
  ctx.globalAlpha = FACE.shadow.alpha * (1 - rise * FACE.shadow.fade);
  ctx.fillStyle = FACE.shadow.color;
  ctx.beginPath();
  ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawFace(ctx, faceId, x, y, bob = 0) {
  const image = faceImage(faceId);
  if (!image) return;

  // (x, y) is the ground point; the face hangs above it.
  ctx.drawImage(
    image,
    Math.round(x - FACE.size / 2),
    Math.round(y - FACE.hover - FACE.size / 2 + bob),
    FACE.size,
    FACE.size,
  );
}

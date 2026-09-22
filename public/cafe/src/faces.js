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

// Objects a person carries or sits behind. Loaded once, indexed by name, never
// per player — the same rule the faces follow, and for the same reason.
const props = new Map();

export async function loadProps(names) {
  await Promise.all(names.map(async (name) => {
    const image = await loadImage(PATHS.props + name + '.png').catch(() => null);
    if (image) props.set(name, image);
  }));
  return props;
}

export function propImage(name) {
  return props.get(name) || null;
}

export function faceImage(faceId) {
  const index = Math.min(Math.max(Math.round(faceId) || 1, 1), FACE_COUNT) - 1;
  return faces[index] || null;
}

// Render state, kept apart from the player itself, and created lazily so a
// player appearing mid-session gets one. None of this belongs to the room and
// none of it travels over the wire.
export function createRenderState() {
  return {
    bob: 0,        // current vertical offset
    phase: 0,      // where we are in the up-and-down, in radians
    amplitude: 0,  // 0 settled, 1 fully bobbing
    idleFor: 0,    // seconds since they last moved
    footfalls: 0,  // completed bob cycles; a footstep sounds on each one
    doorId: undefined,  // the doorway they are standing in; undefined until first looked at
    // Countdowns to the next repeating sound, in seconds. null means the thing
    // that causes them is not happening, so they start from a fresh wait.
    nextDesk: null,
    nextSip: null,
    // Which way they have turned to work, in radians, and where their laptop
    // sits on the table. Both derived from position each tick, so a player
    // arriving over the wire gets them without sending anything extra.
    faceAngle: 0,
    deskAt: null,
    cupAt: null,
    lastX: null,
    lastY: null,
    // Where the wire last said somebody else is. Their drawn position eases
    // towards it rather than jumping to it. Null for the local player, who
    // needs no target: they are already where they are.
    targetX: null,
    targetY: null,
  };
}

const TWO_PI = Math.PI * 2;

// Called once per tick per player. Everything it needs it reads off the player's
// position, so it works the same for someone driven by this keyboard and someone
// arriving through a snapshot.
export function advanceBob(renderState, player, dt, maxStep = FACE.maxStepPx) {
  const previousX = renderState.lastX ?? player.x;
  const previousY = renderState.lastY ?? player.y;
  let distance = Math.hypot(player.x - previousX, player.y - previousY);
  renderState.lastX = player.x;
  renderState.lastY = player.y;

  // Snapping onto a seat, or a snapshot correcting a position, is a jump rather
  // than a stride. Cap it so it cannot fling the bob forward.
  if (distance > maxStep) distance = 0;

  renderState.idleFor = distance > 0.001 ? 0 : renderState.idleFor + dt;
  const walking = player.state !== 'sitting' && renderState.idleFor < FACE.coastSeconds;

  // Phase advances per pixel travelled: walk slower and the bob slows with you.
  // Every completed cycle is one footfall — counted here rather than timed
  // elsewhere, so the sound of a step and the sight of one cannot drift apart.
  if (walking) {
    const advanced = renderState.phase + (distance / FACE.bobPeriodPx) * TWO_PI;
    renderState.footfalls += Math.floor(advanced / TWO_PI);
    renderState.phase = advanced % TWO_PI;
  }

  // Fade in and out rather than snapping, so stopping settles instead of jolting.
  const target = walking ? 1 : 0;
  const step = dt / Math.max(0.001, FACE.settleSeconds);
  if (renderState.amplitude < target) {
    renderState.amplitude = Math.min(target, renderState.amplitude + step);
  } else if (renderState.amplitude > target) {
    renderState.amplitude = Math.max(target, renderState.amplitude - step);
  }

  // Seated is seated: perfectly still, no residue.
  if (player.state === 'sitting' && renderState.amplitude === 0) {
    renderState.phase = 0;
  }

  renderState.bob = Math.sin(renderState.phase) * FACE.bobAmount * renderState.amplitude;
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

export function drawFace(ctx, faceId, x, y, bob = 0, angle = 0, hover = FACE.hover) {
  const image = faceImage(faceId);
  if (!image) return;

  // (x, y) is the ground point; the face hangs above it. How far above is the
  // caller's business: standing, it is head height, and sitting, it is nothing
  // at all — the seat point is the middle of a drawn chair, and that is exactly
  // where the head belongs.
  const left = Math.round(x - FACE.size / 2);
  const top = Math.round(y - hover - FACE.size / 2 + bob);

  if (!angle) {
    ctx.drawImage(image, left, top, FACE.size, FACE.size);
    return;
  }

  // Turning to face a table. Rotated about the centre of the drawing so the
  // head stays where it was rather than swinging off the seat.
  ctx.save();
  ctx.translate(left + FACE.size / 2, top + FACE.size / 2);
  ctx.rotate(angle);
  ctx.drawImage(image, -FACE.size / 2, -FACE.size / 2, FACE.size, FACE.size);
  ctx.restore();
}

// A prop resting on a surface or held beside someone. Drawn at its natural
// size, centred on the point given, and turned if it has a front.
export function drawProp(ctx, name, x, y, angle = 0) {
  const image = propImage(name);
  if (!image) return;

  const left = Math.round(x - image.width / 2);
  const top = Math.round(y - image.height / 2);

  if (!angle) {
    ctx.drawImage(image, left, top);
    return;
  }

  ctx.save();
  ctx.translate(left + image.width / 2, top + image.height / 2);
  ctx.rotate(angle);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);
  ctx.restore();
}

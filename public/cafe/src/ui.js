import { VIEW, FACE, FACE_COUNT } from './config.js';
import { faceImage } from './faces.js';
import { unlock } from './audio.js';
import { play, preload } from './sounds.js';

const NAME_KEY = 'cafe:name';
const FACE_KEY = 'cafe:face';
const LEGACY_FACE_KEY = 'cafe:cat';  // saves from before the faces
const MAX_NAME = 16;

function read(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable; the choice still holds for this session */
  }
}

// Reads the saved face, migrating a pre-faces save rather than throwing it away
// or throwing at it.
export function readFaceId() {
  const saved = Number(read(FACE_KEY, ''));
  if (Number.isInteger(saved) && saved >= 1 && saved <= FACE_COUNT) return saved;

  const legacy = read(LEGACY_FACE_KEY, '');       // e.g. 'cat-03'
  const fromLegacy = Number(String(legacy).replace(/[^0-9]/g, ''));
  if (Number.isInteger(fromLegacy) && fromLegacy >= 1 && fromLegacy <= FACE_COUNT) return fromLegacy;

  return 1;
}

export function cleanName(raw) {
  const trimmed = (raw || '').trim().slice(0, MAX_NAME);
  return trimmed || 'guest';
}

// Audio cannot exist before a user gesture, so the first click on the title
// screen is what brings it into being. Calling this more than once is free.
function startAudio() {
  if (unlock()) preload();
}

// The title screen. Resolves once with the player's choices; the caller starts
// the game from there.
export function showTitle() {
  const screen = document.getElementById('title');
  const nameInput = document.getElementById('title-name');
  const picker = document.getElementById('title-cats');
  const playButton = document.getElementById('title-play');

  let faceId = readFaceId();
  nameInput.value = read(NAME_KEY, '');
  nameInput.maxLength = MAX_NAME;

  // One clickable thumbnail per face, drawn from the very images the game uses.
  picker.innerHTML = '';
  const buttons = new Map();

  for (let id = 1; id <= FACE_COUNT; id++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'face-choice';
    button.id = 'pick-face-' + id;
    button.setAttribute('aria-label', 'Face ' + id);
    button.setAttribute('aria-pressed', String(id === faceId));

    const canvas = document.createElement('canvas');
    canvas.width = FACE.size;
    canvas.height = FACE.size;
    const image = faceImage(id);
    if (image) {
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, 0, 0);
    } else {
      button.textContent = String(id);
    }
    button.appendChild(canvas);

    button.addEventListener('click', () => {
      // The title screen is where the player first touches the page, so it is
      // also where audio is allowed to start. Every button here unlocks it.
      startAudio();
      play('pick');
      faceId = id;
      for (const [otherId, otherButton] of buttons) {
        otherButton.setAttribute('aria-pressed', String(otherId === id));
      }
    });

    buttons.set(id, button);
    picker.appendChild(button);
  }

  screen.hidden = false;
  nameInput.focus();
  nameInput.select();

  return new Promise((resolve) => {
    function start() {
      startAudio();
      // The one moment of arrival the café has: you open the door and it rings.
      play('door');

      const name = cleanName(nameInput.value);
      write(NAME_KEY, name);
      write(FACE_KEY, String(faceId));
      screen.hidden = true;
      cleanup();
      resolve({ name, faceId });
    }

    function onKey(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        start();
      }
    }

    function cleanup() {
      playButton.removeEventListener('click', start);
      screen.removeEventListener('keydown', onKey);
    }

    playButton.addEventListener('click', start);
    screen.addEventListener('keydown', onKey);
  });
}

// --- In-game HUD -----------------------------------------------------------
// Drawn on the canvas at native resolution, so it scales with everything else.
export function drawHud(ctx, player, prompt) {
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';

  const coffee = `COFFEE ${player.coffees}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#2c2c30';
  ctx.fillText(coffee, VIEW.width - 5, 6);
  ctx.fillStyle = '#f2f2f4';
  ctx.fillText(coffee, VIEW.width - 6, 5);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#2c2c30';
  ctx.fillText(player.name, 6, 6);
  ctx.fillStyle = '#f2f2f4';
  ctx.fillText(player.name, 5, 5);

  if (prompt) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#2c2c30';
    ctx.fillText(prompt, VIEW.width / 2 + 1, VIEW.height - 13);
    ctx.fillStyle = '#f2f2f4';
    ctx.fillText(prompt, VIEW.width / 2, VIEW.height - 14);
  }

  ctx.textAlign = 'left';
}

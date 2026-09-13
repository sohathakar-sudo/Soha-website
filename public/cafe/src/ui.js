import { CATS, VIEW, PLAYER } from './config.js';
import { loadCatSheet } from './sprites.js';

const NAME_KEY = 'cafe:name';
const CAT_KEY = 'cafe:cat';
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

export function cleanName(raw) {
  const trimmed = (raw || '').trim().slice(0, MAX_NAME);
  return trimmed || 'guest';
}

// The title screen. Resolves once with the player's choices; the caller starts
// the game from there.
export function showTitle() {
  const screen = document.getElementById('title');
  const nameInput = document.getElementById('title-name');
  const picker = document.getElementById('title-cats');
  const playButton = document.getElementById('title-play');

  let catId = read(CAT_KEY, CATS[0]);
  if (!CATS.includes(catId)) catId = CATS[0];
  nameInput.value = read(NAME_KEY, '');
  nameInput.maxLength = MAX_NAME;

  // One clickable sprite per cat, drawn from the sheet the game itself uses.
  picker.innerHTML = '';
  const buttons = new Map();

  for (const id of CATS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cat-choice';
    button.id = 'pick-' + id;
    button.setAttribute('aria-label', id);
    button.setAttribute('aria-pressed', String(id === catId));

    const canvas = document.createElement('canvas');
    canvas.width = PLAYER.sprite.w;
    canvas.height = PLAYER.sprite.h;
    button.appendChild(canvas);

    loadCatSheet(id)
      .then((sheet) => {
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        // The first 32x32 frame of the sheet; faces replace this next phase.
        ctx.drawImage(sheet, 0, 0, PLAYER.sprite.w, PLAYER.sprite.h, 0, 0, PLAYER.sprite.w, PLAYER.sprite.h);
      })
      .catch(() => { button.textContent = id; });

    button.addEventListener('click', () => {
      catId = id;
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
    function play() {
      const name = cleanName(nameInput.value);
      write(NAME_KEY, name);
      write(CAT_KEY, catId);
      screen.hidden = true;
      cleanup();
      resolve({ name, catId });
    }

    function onKey(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        play();
      }
    }

    function cleanup() {
      playButton.removeEventListener('click', play);
      screen.removeEventListener('keydown', onKey);
    }

    playButton.addEventListener('click', play);
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

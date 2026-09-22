import { VIEW } from './config.js';
import { drawShadow, drawFace, drawProp } from './faces.js';

// Where a carried cup rides relative to the ground point: off to one side and
// a little above the floor, so it reads as held rather than dropped.
const CUP_OFFSET = { x: 13, y: -14 };

// Draw order per frame: background, then sprites sorted by y, then foreground.
export function drawBackground(ctx, image) {
  if (image) {
    ctx.drawImage(image, 0, 0);
    return;
  }
  // Art missing: keep the room legible rather than blanking the screen.
  ctx.fillStyle = '#8f8f95';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = '#6e6e75';
  ctx.fillRect(0, 0, VIEW.width, 40);
}

// Whatever should always occlude a sprite: the front edge of the counter, the
// back half of each table.
export function drawForeground(ctx, image) {
  if (image) ctx.drawImage(image, 0, 0);
}

// Every player is drawn the same way, local or not. Sorting ascending by the
// ground point is what makes someone standing further up the room appear behind
// someone nearer — and sorting by the ground point rather than the face means
// the depth is where their feet are, not where their head floats.
export function drawPlayers(ctx, players, renderStates) {
  const ordered = [...players.values()].sort((a, b) => a.y - b.y);

  for (const player of ordered) {
    const state = renderStates.get(player.id) || {};
    const bob = state.bob || 0;

    // The laptop goes down first: it is on the table, and the person is on the
    // near side of it. Drawn before the shadow so nothing of theirs sits under
    // it.
    if (state.deskAt) drawProp(ctx, 'laptop', state.deskAt.x, state.deskAt.y);

    drawShadow(ctx, player.x, player.y, bob);
    drawFace(ctx, player.faceId, player.x, player.y, bob, state.faceAngle || 0);

    // A coffee is carried beside them, and it goes wherever they go.
    if (player.holdingCoffee) {
      drawProp(ctx, 'cup', player.x + CUP_OFFSET.x, player.y + CUP_OFFSET.y + bob);
    }
  }
}

import { VIEW, PLAYER } from './config.js';
import { frameRect } from './sprites.js';

// Stand-in floor until the room art lands in phase 4.
export function drawFloor(ctx) {
  ctx.fillStyle = '#8f8f95';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = '#6e6e75';
  ctx.fillRect(0, 0, VIEW.width, 40);
}

// Every player is drawn the same way, local or not. Sorting ascending by y is
// what makes someone standing further up the room appear behind someone nearer.
export function drawPlayers(ctx, players, renderStates, sheets) {
  const ordered = [...players.values()].sort((a, b) => a.y - b.y);

  for (const player of ordered) {
    const sheet = sheets.get(player.catId);
    if (!sheet) continue;

    const renderState = renderStates.get(player.id);
    if (!renderState) continue;

    const { sx, sy, sw, sh } = frameRect(player.state, player.dir, renderState);
    ctx.drawImage(
      sheet,
      sx, sy, sw, sh,
      Math.round(player.x - PLAYER.anchor.x),
      Math.round(player.y - PLAYER.anchor.y),
      PLAYER.sprite.w,
      PLAYER.sprite.h,
    );
  }
}

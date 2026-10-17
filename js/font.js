// Text drawn with a rounded web font and a soft drop shadow. Sizes are in game
// pixels: scale 1 is 8px tall, like the arcade's character cells.
const FAMILY = "'Fredoka', 'Trebuchet MS', 'Segoe UI', sans-serif";

export function drawText(ctx, str, x, y, color = '#fff', scale = 1, align = 'left') {
  str = String(str).toUpperCase();
  ctx.font = `600 ${8 * scale}px ${FAMILY}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = align;
  ctx.fillStyle = 'rgba(0,4,20,0.75)';
  ctx.fillText(str, x + 0.5 * scale, y + 0.6 * scale);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.textAlign = 'left';
}

export function drawTextC(ctx, str, cx, y, color, scale = 1) {
  drawText(ctx, str, cx, y, color, scale, 'center');
}

export { FAMILY };

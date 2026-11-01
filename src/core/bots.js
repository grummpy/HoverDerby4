import { zeroInput } from "./inputmap.js";

/**
 * Deterministic steer: hug the middle, bump rivals toward the rim,
 * dash to recover or to finish a ring-out, pulse when someone is in your face.
 */
export function botIntent(match, index) {
  const craft = match.crafts[index];
  if (!craft || !craft.active || !craft.alive) return zeroInput();

  const rdx = craft.x - match.ring.x;
  const rdy = craft.y - match.ring.y;
  const dist = Math.hypot(rdx, rdy) || 0.0001;
  const inwardX = -rdx / dist;
  const inwardY = -rdy / dist;
  const comfort = match.ring.radius * 0.7;

  let tx = inwardX;
  let ty = inwardY;
  let foe = null;
  let foeD = Infinity;

  if (dist < comfort) {
    for (const other of match.crafts) {
      if (!other.active || !other.alive || other.player === craft.player) continue;
      const dx = other.x - craft.x;
      const dy = other.y - craft.y;
      const d = Math.hypot(dx, dy);
      if (d < foeD) {
        foeD = d;
        foe = other;
      }
    }
    if (foe) {
      const foeCenter = Math.hypot(foe.x - match.ring.x, foe.y - match.ring.y) || 1;
      const ox = foe.x + ((foe.x - match.ring.x) / foeCenter) * 36;
      const oy = foe.y + ((foe.y - match.ring.y) / foeCenter) * 36;
      const aimX = ox - craft.x;
      const aimY = oy - craft.y;
      const am = Math.hypot(aimX, aimY) || 1;
      const bias = 0.22 + (index % 2) * 0.05;
      tx = (aimX / am) * (1 - bias) + inwardX * bias;
      ty = (aimY / am) * (1 - bias) + inwardY * bias;
      const tm = Math.hypot(tx, ty) || 1;
      tx /= tm;
      ty /= tm;
    }
  }

  let action = false;
  let secondary = false;
  const foeDist = foe ? Math.hypot(foe.x - match.ring.x, foe.y - match.ring.y) : 0;
  if (foe && foeD < 86 && craft.pulseCd <= 0 && foeDist >= dist - 4) secondary = true;
  if (craft.boostCd <= 0) {
    const inwardSpeed = craft.vx * inwardX + craft.vy * inwardY;
    if (dist >= comfort && inwardSpeed < 80) {
      action = true;
    } else if (foe && foeD < 170 && foeD > 0) {
      const aligned = ((foe.x - craft.x) * tx + (foe.y - craft.y) * ty) / foeD;
      if (foeDist > dist + 10 && aligned > 0.75) action = true;
    }
  }

  return { x: tx, y: ty, action, secondary, pause: false };
}

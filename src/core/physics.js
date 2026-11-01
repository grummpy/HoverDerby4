import {
  ACCEL,
  BOOST_COOLDOWN,
  BOOST_SPEED,
  BOOST_UNCLAMP,
  DRAG_KEEP,
  MAX_SPEED,
  NITRO_ACCEL,
  NITRO_MAX,
  RESTITUTION,
  SPEED_HARD_CAP,
  TURN_RATE,
} from "./constants.js";
import { lerpAngle } from "./vec.js";

export function dragFactor(dt) {
  return Math.pow(DRAG_KEEP, dt);
}

function capSpeed(vx, vy, max) {
  const sp = Math.hypot(vx, vy);
  if (sp > max && sp > 0) {
    const s = max / sp;
    return [vx * s, vy * s];
  }
  return [vx, vy];
}

/**
 * Accelerate, drift (velocity is not snapped to facing), and slide.
 * Boost overspeed is preserved briefly, then clamped.
 */
export function integrateCraft(craft, input, dt) {
  let ix = input.x || 0;
  let iy = input.y || 0;
  const mag = Math.hypot(ix, iy);
  if (mag > 1) {
    ix /= mag;
    iy /= mag;
  }
  const nitro = craft.nitro > 0;
  const accel = ACCEL * (nitro ? NITRO_ACCEL : 1);
  const max = MAX_SPEED * (nitro ? NITRO_MAX : 1);
  const speed = Math.hypot(craft.vx, craft.vy);
  if (mag > 0.01 && speed < max) {
    craft.vx += ix * accel * dt;
    craft.vy += iy * accel * dt;
    const target = Math.atan2(iy, ix);
    const k = Math.min(1, TURN_RATE * dt);
    craft.facing = lerpAngle(craft.facing, target, k);
  }
  const drag = dragFactor(dt);
  craft.vx *= drag;
  craft.vy *= drag;
  const inBoostWindow = craft.boostCd > BOOST_COOLDOWN - BOOST_UNCLAMP;
  if (!inBoostWindow) {
    [craft.vx, craft.vy] = capSpeed(craft.vx, craft.vy, max);
  }
  [craft.vx, craft.vy] = capSpeed(craft.vx, craft.vy, SPEED_HARD_CAP);
  craft.x += craft.vx * dt;
  craft.y += craft.vy * dt;
}

/** Direction the craft will dash: stick, or nose if the stick is idle. */
export function boostVector(craft, input) {
  let dx = input.x || 0;
  let dy = input.y || 0;
  const m = Math.hypot(dx, dy);
  if (m < 0.2) {
    return [Math.cos(craft.facing), Math.sin(craft.facing)];
  }
  return [dx / m, dy / m];
}

export function applyBoost(craft, input) {
  const [dx, dy] = boostVector(craft, input);
  const power = craft.nitro > 0 ? BOOST_SPEED * 1.2 : BOOST_SPEED;
  craft.vx += dx * power;
  craft.vy += dy * power;
  [craft.vx, craft.vy] = capSpeed(craft.vx, craft.vy, SPEED_HARD_CAP);
  craft.boostCd = BOOST_COOLDOWN;
  craft.facing = Math.atan2(dy, dx);
}

/**
 * Circle-circle collision. Separates overlap every call.
 * Returns true only when an approaching pair received an elastic impulse.
 */
export function collidePair(a, b) {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let dist = Math.hypot(dx, dy);
  const minDist = a.radius + b.radius;
  if (dist >= minDist) return false;
  let nx;
  let ny;
  if (dist < 1e-8) {
    nx = 1;
    ny = 0;
    dist = 1e-8;
  } else {
    nx = dx / dist;
    ny = dy / dist;
  }
  const overlap = minDist - dist;
  const total = a.mass + b.mass;
  a.x -= nx * overlap * (b.mass / total);
  a.y -= ny * overlap * (b.mass / total);
  b.x += nx * overlap * (a.mass / total);
  b.y += ny * overlap * (a.mass / total);

  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const velN = rvx * nx + rvy * ny;
  if (velN >= 0) return false;
  const invA = 1 / a.mass;
  const invB = 1 / b.mass;
  const j = (-(1 + RESTITUTION) * velN) / (invA + invB);
  const ix = j * nx;
  const iy = j * ny;
  a.vx -= ix * invA;
  a.vy -= iy * invA;
  b.vx += ix * invB;
  b.vy += iy * invB;
  return true;
}

/** Keep a shielded craft inside the ring and kill outward speed. */
export function clampInside(craft, ring) {
  const dx = craft.x - ring.x;
  const dy = craft.y - ring.y;
  const dist = Math.hypot(dx, dy);
  const limit = Math.max(0, ring.radius - 0.05);
  if (dist <= limit || dist < 1e-8) return;
  const nx = dx / dist;
  const ny = dy / dist;
  craft.x = ring.x + nx * limit;
  craft.y = ring.y + ny * limit;
  const vn = craft.vx * nx + craft.vy * ny;
  if (vn > 0) {
    craft.vx -= vn * nx;
    craft.vy -= vn * ny;
  }
}

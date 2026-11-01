import {
  HEAVY_MULT,
  HEAVY_TIME,
  MASS,
  NITRO_TIME,
  POWERUP_RADIUS,
  SHIELD_TIME,
} from "./constants.js";

export function applyPowerup(craft, type) {
  if (type === "nitro") {
    craft.nitro = NITRO_TIME;
    craft.boostCd = 0;
    return;
  }
  if (type === "shield") {
    craft.shield = SHIELD_TIME;
    return;
  }
  if (type === "heavy") {
    craft.heavy = HEAVY_TIME;
    craft.mass = MASS * HEAVY_MULT;
  }
}

export function refreshMass(craft) {
  craft.mass = craft.heavy > 0 ? MASS * HEAVY_MULT : MASS;
}

export function makePowerup(type, x, y) {
  return { type, x, y, radius: POWERUP_RADIUS, taken: false };
}

export function circlesOverlap(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = a.radius + b.radius;
  return dx * dx + dy * dy <= r * r;
}

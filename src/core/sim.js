import { botIntent } from "./bots.js";
import {
  CRAFT_RADIUS,
  DEFAULT_ROUNDS,
  DT,
  HEAVY_MULT,
  MASS,
  MAX_POWERUPS,
  PLAYER_COUNT,
  POWER_FIRST_SPAWN,
  POWER_SPAWN_INTERVAL,
  POWER_TYPES,
  PULSE_COOLDOWN,
  PULSE_IMPULSE,
  PULSE_RADIUS,
  RING_MIN,
  SPEED_HARD_CAP,
  RING_SOFT,
  RING_START,
  SHRINK_PER_SEC,
  SHRINK_SUDDEN,
  SPAWN_DIST,
} from "./constants.js";
import { zeroInput } from "./inputmap.js";
import { applyBoost, clampInside, collidePair, integrateCraft } from "./physics.js";
import { applyPowerup, circlesOverlap, makePowerup, refreshMass } from "./powerups.js";
import { makeRng } from "./rng.js";

const SPAWN_ANGLES = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];

function makeCraft(player, kind) {
  const active = kind === "human" || kind === "bot";
  return {
    player,
    kind: active ? kind : "off",
    active,
    alive: active,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    facing: -Math.PI / 2,
    radius: CRAFT_RADIUS,
    mass: MASS,
    boostCd: 0,
    pulseCd: 0,
    actionHeld: false,
    secondaryHeld: false,
    nitro: 0,
    shield: 0,
    heavy: 0,
  };
}

export function placeCrafts(match) {
  const dist = match.ring.radius * SPAWN_DIST;
  for (const craft of match.crafts) {
    if (!craft.active) continue;
    const jitter = (match.rng() - 0.5) * 0.08;
    const ang = SPAWN_ANGLES[craft.player] + jitter;
    craft.x = match.ring.x + Math.cos(ang) * dist;
    craft.y = match.ring.y + Math.sin(ang) * dist;
    craft.vx = 0;
    craft.vy = 0;
    craft.facing = Math.atan2(match.ring.y - craft.y, match.ring.x - craft.x);
  }
}

function normalizeSlots(slots) {
  const out = [];
  for (let i = 0; i < PLAYER_COUNT; i++) {
    const kind = slots && slots[i] && slots[i].kind;
    if (kind === "human" || kind === "bot" || kind === "off") out.push({ kind });
    else out.push({ kind: "bot" });
  }
  return out;
}

/**
 * @param {{ seed?: number, roundsToWin?: number, slots?: {kind: string}[] }} [options]
 */
export function createMatch(options = {}) {
  const seed = options.seed ?? 1;
  const match = {
    seed,
    rng: makeRng(seed),
    roundsToWin: options.roundsToWin ?? DEFAULT_ROUNDS,
    round: 1,
    scores: [0, 0, 0, 0],
    phase: "play",
    roundWinner: null,
    matchWinner: null,
    time: 0,
    tick: 0,
    spawnTimer: POWER_FIRST_SPAWN,
    ring: { x: 0, y: 0, radius: RING_START },
    powerups: [],
    crafts: normalizeSlots(options.slots).map((slot, i) => makeCraft(i, slot.kind)),
    events: [],
  };
  placeCrafts(match);
  return match;
}

export function shrinkRing(match, dt) {
  const rate = match.ring.radius > RING_SOFT ? SHRINK_PER_SEC : SHRINK_SUDDEN;
  match.ring.radius = Math.max(RING_MIN, match.ring.radius - rate * dt);
}

export function spawnPowerup(match, spec) {
  const power = makePowerup(spec.type, spec.x, spec.y);
  match.powerups.push(power);
  return power;
}

function maybeSpawn(match) {
  match.spawnTimer -= DT;
  if (match.spawnTimer > 0) return;
  match.spawnTimer = POWER_SPAWN_INTERVAL;
  if (match.powerups.length >= MAX_POWERUPS) return;
  const type = POWER_TYPES[Math.floor(match.rng() * POWER_TYPES.length) % POWER_TYPES.length];
  const ang = match.rng() * Math.PI * 2;
  const rad = (0.15 + match.rng() * 0.45) * match.ring.radius;
  match.powerups.push(makePowerup(type, Math.cos(ang) * rad, Math.sin(ang) * rad));
  match.events.push({ type: "spawn", power: type });
}

function doPulse(match, craft) {
  craft.pulseCd = PULSE_COOLDOWN;
  for (const other of match.crafts) {
    if (!other.active || !other.alive || other === craft) continue;
    let dx = other.x - craft.x;
    let dy = other.y - craft.y;
    let dist = Math.hypot(dx, dy);
    if (dist > PULSE_RADIUS) continue;
    if (dist < 1e-4) {
      dx = 1;
      dy = 0;
      dist = 1;
    }
    const falloff = 1 - dist / PULSE_RADIUS;
    const impulse = (PULSE_IMPULSE * falloff) / other.mass;
    other.vx += (dx / dist) * impulse;
    other.vy += (dy / dist) * impulse;
    const sp = Math.hypot(other.vx, other.vy);
    if (sp > SPEED_HARD_CAP) {
      other.vx = (other.vx / sp) * SPEED_HARD_CAP;
      other.vy = (other.vy / sp) * SPEED_HARD_CAP;
    }
  }
  match.events.push({ type: "pulse", player: craft.player });
}

function award(match, player) {
  if (match.phase !== "play") return;
  match.roundWinner = player;
  match.scores[player] += 1;
  match.events.push({ type: "round", player });
  if (match.scores[player] >= match.roundsToWin) {
    match.phase = "matchover";
    match.matchWinner = player;
  } else {
    match.phase = "roundover";
  }
}

function checkRoundEnd(match, died) {
  const contenders = match.crafts.filter((c) => c.active);
  if (contenders.length < 2) return;
  const still = contenders.filter((c) => c.alive);
  if (still.length === 1) {
    award(match, still[0].player);
    return;
  }
  if (still.length === 0 && died.length) {
    died.sort((a, b) => a.dist - b.dist);
    award(match, died[0].craft.player);
  }
}

/** One 60 Hz tick. `inputs` is length 4; missing entries count as idle. */
export function stepMatch(match, inputs) {
  match.events = [];
  if (match.phase !== "play") return match;
  match.time += DT;
  match.tick += 1;

  for (const craft of match.crafts) {
    if (!craft.active) continue;
    craft.boostCd = Math.max(0, craft.boostCd - DT);
    craft.pulseCd = Math.max(0, craft.pulseCd - DT);
    craft.nitro = Math.max(0, craft.nitro - DT);
    craft.shield = Math.max(0, craft.shield - DT);
    craft.heavy = Math.max(0, craft.heavy - DT);
    refreshMass(craft);
  }

  for (const craft of match.crafts) {
    if (!craft.active || !craft.alive) continue;
    const input = sanitize(inputs && inputs[craft.player]);
    integrateCraft(craft, input, DT);
    if (input.action && !craft.actionHeld && craft.boostCd <= 0) {
      applyBoost(craft, input);
      match.events.push({ type: "boost", player: craft.player });
    }
    craft.actionHeld = input.action;
    if (input.secondary && !craft.secondaryHeld && craft.pulseCd <= 0) {
      doPulse(match, craft);
    }
    craft.secondaryHeld = input.secondary;
  }

  const alive = match.crafts.filter((c) => c.active && c.alive);
  const hitPairs = new Set();
  for (let iter = 0; iter < 3; iter++) {
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const impacted = collidePair(alive[i], alive[j]);
        if (impacted && iter === 0) {
          const key = `${alive[i].player}:${alive[j].player}`;
          if (!hitPairs.has(key)) {
            hitPairs.add(key);
            match.events.push({ type: "hit", a: alive[i].player, b: alive[j].player });
          }
        }
      }
    }
  }

  for (const craft of alive) {
    if (!craft.alive) continue;
    for (const power of match.powerups) {
      if (power.taken) continue;
      if (!circlesOverlap(craft, power)) continue;
      power.taken = true;
      applyPowerup(craft, power.type);
      match.events.push({ type: "pickup", player: craft.player, power: power.type });
    }
  }
  match.powerups = match.powerups.filter((p) => !p.taken);

  shrinkRing(match, DT);
  maybeSpawn(match);

  const died = [];
  for (const craft of match.crafts) {
    if (!craft.active || !craft.alive) continue;
    const dist = Math.hypot(craft.x - match.ring.x, craft.y - match.ring.y);
    if (dist <= match.ring.radius) continue;
    if (craft.shield > 0) {
      clampInside(craft, match.ring);
      match.events.push({ type: "shield", player: craft.player });
      continue;
    }
    craft.alive = false;
    died.push({ craft, dist });
    match.events.push({ type: "ko", player: craft.player });
  }

  checkRoundEnd(match, died);
  return match;
}

function sanitize(input) {
  const base = zeroInput();
  if (!input) return base;
  let x = Number(input.x) || 0;
  let y = Number(input.y) || 0;
  if (!Number.isFinite(x)) x = 0;
  if (!Number.isFinite(y)) y = 0;
  const m = Math.hypot(x, y);
  if (m > 1) {
    x /= m;
    y /= m;
  }
  base.x = x;
  base.y = y;
  base.action = !!input.action;
  base.secondary = !!input.secondary;
  base.pause = !!input.pause;
  return base;
}

export function nextRound(match) {
  if (match.phase === "matchover") return match;
  if (match.phase !== "roundover") return match;
  match.round += 1;
  match.phase = "play";
  match.roundWinner = null;
  match.ring.radius = RING_START;
  match.powerups = [];
  match.spawnTimer = POWER_FIRST_SPAWN;
  for (const craft of match.crafts) {
    if (!craft.active) continue;
    craft.alive = true;
    craft.vx = 0;
    craft.vy = 0;
    craft.boostCd = 0;
    craft.pulseCd = 0;
    craft.nitro = 0;
    craft.shield = 0;
    craft.heavy = 0;
    craft.mass = MASS;
    craft.actionHeld = false;
    craft.secondaryHeld = false;
  }
  placeCrafts(match);
  return match;
}

/** Fill bot slots. A connected pad (connected[i]) lets a human drive that slot instead. */
export function resolveInputs(match, merged, connected) {
  return match.crafts.map((craft, i) => {
    if (craft.kind === "bot" && !(connected && connected[i])) return botIntent(match, i);
    return merged[i] || zeroInput();
  });
}

export function digest(match) {
  return JSON.stringify({
    time: match.time,
    tick: match.tick,
    phase: match.phase,
    scores: match.scores,
    roundWinner: match.roundWinner,
    matchWinner: match.matchWinner,
    ring: match.ring.radius,
    crafts: match.crafts.map((c) => ({
      x: c.x,
      y: c.y,
      vx: c.vx,
      vy: c.vy,
      facing: c.facing,
      alive: c.alive,
      mass: c.mass,
      boostCd: c.boostCd,
      pulseCd: c.pulseCd,
      nitro: c.nitro,
      shield: c.shield,
      heavy: c.heavy,
    })),
    powerups: match.powerups.map((p) => ({ t: p.type, x: p.x, y: p.y })),
  });
}

export { applyPowerup, DT, HEAVY_MULT, MASS, RING_START };

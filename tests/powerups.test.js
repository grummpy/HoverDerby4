import assert from "node:assert/strict";
import test from "node:test";
import {
  BOOST_COOLDOWN,
  HEAVY_MULT,
  MASS,
  NITRO_TIME,
  PULSE_COOLDOWN,
  PULSE_IMPULSE,
  SHIELD_TIME,
} from "../src/core/constants.js";
import { createMatch, spawnPowerup, stepMatch } from "../src/core/sim.js";
import { DUEL, drive, zeros } from "./helpers.js";

test("nitro refills boost and speeds the craft up", () => {
  const plain = createMatch({ seed: 9, slots: [{ kind: "human" }, { kind: "off" }, { kind: "off" }, { kind: "off" }] });
  const juiced = createMatch({ seed: 9, slots: [{ kind: "human" }, { kind: "off" }, { kind: "off" }, { kind: "off" }] });
  for (const match of [plain, juiced]) {
    match.crafts[0].x = 0;
    match.crafts[0].y = 0;
    match.crafts[0].vx = 0;
    match.crafts[0].vy = 0;
  }
  juiced.crafts[0].boostCd = 1.1;
  spawnPowerup(juiced, { type: "nitro", x: 0, y: 0 });
  stepMatch(juiced, zeros());
  assert.equal(juiced.powerups.length, 0);
  assert.ok(Math.abs(juiced.crafts[0].nitro - NITRO_TIME) < 1e-9);
  assert.equal(juiced.crafts[0].boostCd, 0);
  assert.equal(juiced.events.some((event) => event.type === "pickup" && event.power === "nitro"), true);

  const input = { x: 1, y: 0, action: false, secondary: false };
  for (let i = 0; i < 40; i++) {
    stepMatch(plain, drive(0, input));
    stepMatch(juiced, drive(0, input));
  }
  assert.ok(juiced.crafts[0].x > plain.crafts[0].x);
});

test("shield keeps a craft that has left the ring", () => {
  const match = createMatch({ seed: 2, slots: DUEL });
  const craft = match.crafts[0];
  craft.shield = SHIELD_TIME;
  craft.x = match.ring.radius + 90;
  craft.y = 0;
  craft.vx = 40;
  craft.vy = 0;
  match.crafts[1].x = 0;
  match.crafts[1].y = 0;
  stepMatch(match, zeros());
  assert.equal(craft.alive, true);
  assert.ok(Math.hypot(craft.x, craft.y) <= match.ring.radius + 1e-6);
  assert.equal(match.phase, "play");
});

test("heavy pickup raises mass", () => {
  const match = createMatch({ seed: 2, slots: DUEL });
  const craft = match.crafts[0];
  craft.x = 0;
  craft.y = 0;
  spawnPowerup(match, { type: "heavy", x: 0, y: 0 });
  stepMatch(match, zeros());
  assert.equal(craft.mass, MASS * HEAVY_MULT);
  assert.ok(craft.heavy > 0);
  assert.equal(match.powerups.length, 0);
});

test("pulse shoves a nearby craft and then cools down", () => {
  const match = createMatch({ seed: 2, slots: DUEL });
  const a = match.crafts[0];
  const b = match.crafts[1];
  a.x = -30;
  a.y = 0;
  a.vx = 0;
  a.vy = 0;
  b.x = 30;
  b.y = 0;
  b.vx = 0;
  b.vy = 0;
  stepMatch(match, drive(0, { x: 0, y: 0, action: false, secondary: true }));
  assert.ok(b.vx > PULSE_IMPULSE * 0.25, "pulse should throw the other craft outward");
  assert.ok(Math.abs(a.pulseCd - PULSE_COOLDOWN) < 1e-9);
  const cooldown = a.pulseCd;
  stepMatch(match, drive(0, { x: 0, y: 0, action: false, secondary: true }));
  assert.ok(a.pulseCd < cooldown, "holding pulse does not fire again");
  assert.ok(BOOST_COOLDOWN > 0);
});

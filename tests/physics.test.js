import assert from "node:assert/strict";
import test from "node:test";
import { BOOST_SPEED, CRAFT_RADIUS, DT, SHRINK_PER_SEC } from "../src/core/constants.js";
import { collidePair } from "../src/core/physics.js";
import { createMatch, stepMatch } from "../src/core/sim.js";
import { DUEL, drive, zeros } from "./helpers.js";

test("holding a direction builds speed and then drifts after release", () => {
  const match = createMatch({
    seed: 4,
    slots: [{ kind: "human" }, { kind: "off" }, { kind: "off" }, { kind: "off" }],
  });
  const craft = match.crafts[0];
  craft.x = 0;
  craft.y = 0;
  craft.vx = 0;
  craft.vy = 0;
  const startX = craft.x;
  for (let i = 0; i < 60; i++) stepMatch(match, drive(0, { x: 1, y: 0, action: false, secondary: false }));
  assert.ok(craft.x > startX + 20, "craft should travel right");
  assert.ok(craft.vx > 40, "velocity should build under thrust");
  const peak = craft.vx;
  for (let i = 0; i < 30; i++) stepMatch(match, zeros());
  assert.ok(craft.vx > 10, "inertia keeps the craft sliding");
  assert.ok(craft.vx < peak, "drag slows the craft once thrust stops");
  assert.equal(craft.alive, true);
});

test("opposite keys cancel and idle input does not add speed", () => {
  const match = createMatch({ seed: 4, slots: DUEL });
  const craft = match.crafts[0];
  craft.x = 0;
  craft.y = 0;
  craft.vx = 0;
  craft.vy = 0;
  stepMatch(match, drive(0, { x: 0, y: 0, action: false, secondary: false }));
  assert.ok(Math.abs(craft.vx) < 1e-6);
  assert.ok(Math.abs(craft.vy) < 1e-6);
});

test("equal-mass head-on collision exchanges velocity", () => {
  const a = { x: 0, y: 0, vx: 60, vy: 0, radius: 20, mass: 1 };
  const b = { x: 30, y: 0, vx: -60, vy: 0, radius: 20, mass: 1 };
  assert.equal(collidePair(a, b), true);
  assert.ok(Math.abs(a.vx + 60) < 1e-6);
  assert.ok(Math.abs(b.vx - 60) < 1e-6);
  assert.ok(Math.hypot(b.x - a.x, b.y - a.y) >= 40 - 1e-6);
});

test("a heavier craft keeps more of its momentum", () => {
  const a = { x: 0, y: 0, vx: 40, vy: 0, radius: 20, mass: 2.4 };
  const b = { x: 30, y: 0, vx: 0, vy: 0, radius: 20, mass: 1 };
  assert.equal(collidePair(a, b), true);
  assert.ok(b.vx > a.vx, "lighter craft is launched harder");
  assert.ok(b.vx > 40, "lighter craft leaves faster than the incoming speed");
  assert.ok(a.vx > 0, "heavy craft is not fully stopped");
});

test("overlapping crafts separate inside a live step", () => {
  const match = createMatch({ seed: 8, slots: DUEL });
  const a = match.crafts[0];
  const b = match.crafts[1];
  a.x = -10;
  a.y = 0;
  a.vx = 90;
  a.vy = 0;
  b.x = 10;
  b.y = 0;
  b.vx = -90;
  b.vy = 0;
  stepMatch(match, zeros());
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  assert.ok(dist >= CRAFT_RADIUS * 2 - 0.05);
  assert.ok(a.vx < 0 && b.vx > 0, "they should bounce apart");
});

test("the ring shrinks every tick", () => {
  const match = createMatch({ seed: 1, slots: DUEL });
  const before = match.ring.radius;
  stepMatch(match, zeros());
  assert.ok(Math.abs(match.ring.radius - (before - SHRINK_PER_SEC * DT)) < 1e-9);
});

test("boost is a single impulse with a cooldown", () => {
  const match = createMatch({ seed: 2, slots: DUEL });
  const craft = match.crafts[0];
  craft.x = 0;
  craft.y = 0;
  craft.vx = 0;
  craft.vy = 0;
  craft.facing = 0;
  const input = { x: 1, y: 0, action: true, secondary: false };
  stepMatch(match, drive(0, input));
  assert.ok(craft.vx > BOOST_SPEED * 0.9);
  assert.ok(craft.boostCd > 1);
  const speed = craft.vx;
  const cooldown = craft.boostCd;
  stepMatch(match, drive(0, input));
  assert.ok(craft.vx < speed, "holding boost does not stack another dash");
  assert.ok(craft.boostCd < cooldown);
});

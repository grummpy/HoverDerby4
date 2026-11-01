import assert from "node:assert/strict";
import test from "node:test";
import { botIntent } from "../src/core/bots.js";
import { createMatch } from "../src/core/sim.js";

test("a bot near the rim steers and boosts back toward the center", () => {
  const match = createMatch({
    seed: 1,
    slots: [
      { kind: "bot" },
      { kind: "bot" },
      { kind: "off" },
      { kind: "off" },
    ],
  });
  const craft = match.crafts[0];
  craft.x = match.ring.radius * 0.9;
  craft.y = 0;
  craft.vx = 0;
  craft.vy = 0;
  craft.boostCd = 0;
  const input = botIntent(match, 0);
  assert.ok(input.x < -0.5, "aim should point inward");
  assert.ok(Math.abs(input.y) < 0.35);
  assert.equal(input.action, true);
  assert.equal(input.pause, false);
  assert.ok(Math.hypot(input.x, input.y) <= 1 + 1e-6);
});

test("an eliminated bot contributes no input", () => {
  const match = createMatch({ seed: 1, slots: [{ kind: "bot" }, { kind: "off" }, { kind: "off" }, { kind: "off" }] });
  match.crafts[0].alive = false;
  const input = botIntent(match, 0);
  assert.deepEqual(input, { x: 0, y: 0, action: false, secondary: false, pause: false });
});

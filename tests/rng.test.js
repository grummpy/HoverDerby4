import assert from "node:assert/strict";
import test from "node:test";
import { makeRng } from "../src/core/rng.js";
import { botIntent } from "../src/core/bots.js";
import { createMatch, digest, stepMatch } from "../src/core/sim.js";

function scripted(tick) {
  return [0, 1, 2, 3].map((player) => ({
    x: Math.sin(tick * 0.05 + player),
    y: Math.cos(tick * 0.04 + player * 2),
    action: tick % 40 === player * 3,
    secondary: tick % 55 === player * 5,
  }));
}

function run(seed, steps) {
  const match = createMatch({
    seed,
    slots: [
      { kind: "human" },
      { kind: "human" },
      { kind: "human" },
      { kind: "human" },
    ],
  });
  for (let tick = 0; tick < steps; tick++) {
    if (match.phase !== "play") break;
    stepMatch(match, scripted(tick));
  }
  return digest(match);
}

test("the same seed replays the same random stream", () => {
  const left = makeRng(42);
  const right = makeRng(42);
  const a = Array.from({ length: 8 }, () => left());
  const b = Array.from({ length: 8 }, () => right());
  assert.deepEqual(a, b);
  assert.notEqual(makeRng(42)(), makeRng(43)());
  for (const value of a) {
    assert.ok(value >= 0 && value < 1);
  }
});

test("a full match is deterministic for a seed and diverges for another", () => {
  const first = run(11, 240);
  const second = run(11, 240);
  const other = run(12, 240);
  assert.equal(first, second);
  assert.notEqual(first, other);
});

test("bot steering stays finite across a solo match", () => {
  const match = createMatch({
    seed: 7,
    slots: [
      { kind: "bot" },
      { kind: "bot" },
      { kind: "bot" },
      { kind: "bot" },
    ],
  });
  for (let i = 0; i < 60 * 12; i++) {
    if (match.phase !== "play") break;
    const inputs = [0, 1, 2, 3].map((player) => botIntent(match, player));
    stepMatch(match, inputs);
  }
  for (const craft of match.crafts) {
    assert.ok(Number.isFinite(craft.x));
    assert.ok(Number.isFinite(craft.y));
    assert.ok(Number.isFinite(craft.vx));
    assert.ok(Number.isFinite(craft.vy));
  }
  assert.ok(match.scores.reduce((sum, score) => sum + score, 0) >= 0);
});

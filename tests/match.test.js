import assert from "node:assert/strict";
import test from "node:test";
import { createMatch, nextRound, stepMatch } from "../src/core/sim.js";
import { DUEL, zeros } from "./helpers.js";

function knockOutSecond(match) {
  const ring = match.ring.radius;
  const a = match.crafts[0];
  const b = match.crafts[1];
  a.x = 0;
  a.y = 0;
  a.vx = 0;
  a.vy = 0;
  a.alive = true;
  a.shield = 0;
  b.x = ring + 40;
  b.y = 0;
  b.vx = 0;
  b.vy = 0;
  b.alive = true;
  b.shield = 0;
  stepMatch(match, zeros());
}

test("leaving the ring eliminates that craft", () => {
  const match = createMatch({ seed: 1, slots: DUEL });
  knockOutSecond(match);
  assert.equal(match.crafts[1].alive, false);
  assert.equal(match.crafts[0].alive, true);
  assert.equal(match.events.some((event) => event.type === "ko" && event.player === 1), true);
});

test("one elimination does not end a round while two others remain", () => {
  const match = createMatch({
    seed: 1,
    slots: [{ kind: "human" }, { kind: "human" }, { kind: "human" }, { kind: "off" }],
  });
  match.crafts[2].x = match.ring.radius + 50;
  match.crafts[2].y = 0;
  match.crafts[2].vx = 0;
  match.crafts[2].vy = 0;
  match.crafts[0].x = 0;
  match.crafts[1].x = 20;
  match.crafts[0].y = 0;
  match.crafts[1].y = 0;
  stepMatch(match, zeros());
  assert.equal(match.crafts[2].alive, false);
  assert.equal(match.phase, "play");
  assert.deepEqual(match.scores, [0, 0, 0, 0]);
});

test("last craft inside the ring wins the round", () => {
  const match = createMatch({ seed: 3, roundsToWin: 3, slots: DUEL });
  knockOutSecond(match);
  assert.equal(match.phase, "roundover");
  assert.equal(match.roundWinner, 0);
  assert.equal(match.scores[0], 1);
  assert.equal(match.scores[1], 0);
});

test("if everyone leaves on the same tick the closest craft wins", () => {
  const match = createMatch({ seed: 3, slots: DUEL });
  const ring = match.ring.radius;
  match.crafts[0].x = ring + 15;
  match.crafts[0].y = 0;
  match.crafts[0].vx = 0;
  match.crafts[1].x = ring + 80;
  match.crafts[1].y = 0;
  match.crafts[1].vx = 0;
  stepMatch(match, zeros());
  assert.equal(match.crafts[0].alive, false);
  assert.equal(match.crafts[1].alive, false);
  assert.equal(match.roundWinner, 0);
  assert.equal(match.scores[0], 1);
});

test("first to 3 rounds wins the match and further steps do not add score", () => {
  const match = createMatch({ seed: 5, roundsToWin: 3, slots: DUEL });
  knockOutSecond(match);
  assert.equal(match.phase, "roundover");
  nextRound(match);
  assert.equal(match.phase, "play");
  assert.equal(match.round, 2);
  assert.equal(match.crafts[0].alive, true);
  assert.equal(match.crafts[1].alive, true);
  assert.ok(match.ring.radius > 300);

  knockOutSecond(match);
  assert.equal(match.phase, "roundover");
  assert.equal(match.scores[0], 2);
  nextRound(match);
  knockOutSecond(match);
  assert.equal(match.phase, "matchover");
  assert.equal(match.matchWinner, 0);
  assert.equal(match.scores[0], 3);

  const frozen = match.scores[0];
  stepMatch(match, zeros());
  nextRound(match);
  assert.equal(match.phase, "matchover");
  assert.equal(match.scores[0], frozen);
});

test("first to 1 ends the match on the opening round", () => {
  const match = createMatch({ seed: 6, roundsToWin: 1, slots: DUEL });
  knockOutSecond(match);
  assert.equal(match.phase, "matchover");
  assert.equal(match.matchWinner, 0);
  assert.equal(match.scores[0], 1);
});

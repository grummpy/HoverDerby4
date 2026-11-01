import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_BINDINGS } from "../src/core/constants.js";
import {
  actionsFromKeyboard,
  keyLabel,
  keyboardPause,
  mergeInputs,
  readGamepads,
  sanitizeBindings,
} from "../src/core/inputmap.js";

function pad(partial = {}) {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
  for (const index of partial.pressed || []) buttons[index] = { pressed: true };
  return {
    connected: partial.connected !== false,
    axes: partial.axes || [0, 0, 0, 0],
    buttons,
  };
}

test("default keyboard map covers all four riders", () => {
  const pressed = new Set([
    "KeyW",
    "KeyD",
    "KeyF",
    "ArrowLeft",
    "Slash",
    "KeyK",
    "Quote",
    "Numpad6",
    "Numpad0",
  ]);
  const actions = actionsFromKeyboard(pressed, DEFAULT_BINDINGS);
  assert.ok(Math.abs(actions[0].x - Math.SQRT1_2) < 1e-10);
  assert.ok(Math.abs(actions[0].y + Math.SQRT1_2) < 1e-10);
  assert.equal(actions[0].action, true);
  assert.equal(actions[0].secondary, false);

  assert.equal(actions[1].x, -1);
  assert.equal(actions[1].y, 0);
  assert.equal(actions[1].action, true);

  assert.equal(actions[2].y, 1);
  assert.equal(actions[2].secondary, true);
  assert.equal(actions[2].action, false);

  assert.equal(actions[3].x, 1);
  assert.equal(actions[3].action, true);
  assert.equal(actions[3].secondary, false);
});

test("opposite keys cancel and labels match the printed keys", () => {
  const actions = actionsFromKeyboard(new Set(["KeyW", "KeyS"]), DEFAULT_BINDINGS);
  assert.equal(actions[0].y, 0);
  assert.equal(keyLabel("Slash"), "/");
  assert.equal(keyLabel("Quote"), "'");
  assert.equal(keyLabel("Period"), ".");
  assert.equal(keyLabel("Semicolon"), ";");
  assert.equal(keyLabel("NumpadEnter"), "Num Enter");
  assert.equal(keyLabel("ArrowUp"), "↑");
  assert.equal(keyLabel("KeyG"), "G");
});

test("bindings can be remapped and broken data falls back", () => {
  const bindings = sanitizeBindings(null);
  bindings[0].up = "KeyT";
  const actions = actionsFromKeyboard(new Set(["KeyT"]), bindings);
  assert.equal(actions[0].y, -1);
  const repaired = sanitizeBindings([{ up: "", down: 4 }, null, { action: "KeyQ" }, {}]);
  assert.equal(repaired[0].up, DEFAULT_BINDINGS[0].up);
  assert.equal(repaired[0].down, DEFAULT_BINDINGS[0].down);
  assert.equal(repaired[2].action, "KeyQ");
  assert.equal(repaired[2].secondary, DEFAULT_BINDINGS[2].secondary);
  assert.equal(repaired.length, 4);
});

test("gamepad stick, d-pad, buttons, and deadzone", () => {
  const up = readGamepads([pad({ axes: [0, -1], pressed: [0] }), null, null, null]);
  assert.ok(up.actions[0].y < -0.9);
  assert.equal(up.actions[0].action, true);
  assert.equal(up.connected[0], true);
  assert.equal(up.connected[1], false);

  const dead = readGamepads([pad({ axes: [0.1, 0] }), null, null, null]);
  assert.equal(dead.actions[0].x, 0);
  assert.equal(dead.actions[0].y, 0);

  const dpad = readGamepads([pad({ axes: [1, 0], pressed: [14, 1, 9] }), null, null, null]);
  assert.equal(dpad.actions[0].x, -1);
  assert.equal(dpad.actions[0].y, 0);
  assert.equal(dpad.actions[0].secondary, true);
  assert.equal(dpad.pause, true);
  assert.equal(dpad.actions[0].pause, true);
});

test("a connected pad overrides that rider's keyboard", () => {
  const keyboard = actionsFromKeyboard(new Set(["KeyW", "KeyF", "ArrowLeft"]), DEFAULT_BINDINGS);
  const idlePad = readGamepads([pad({ axes: [0, 0] }), null, null, null]);
  const overridden = mergeInputs(keyboard, idlePad.actions, idlePad.connected);
  assert.equal(overridden[0].action, false);
  assert.equal(overridden[0].y, 0);
  assert.equal(overridden[1].x, -1, "disconnected riders keep the keyboard");

  const active = readGamepads([pad({ axes: [0, 1], pressed: [0] }), null, null, null]);
  const merged = mergeInputs(keyboard, active.actions, active.connected);
  assert.ok(merged[0].y > 0.9);
  assert.equal(merged[0].action, true);
});

test("escape is the keyboard pause chord", () => {
  assert.equal(keyboardPause(new Set(["Escape"])), true);
  assert.equal(keyboardPause(new Set(["KeyW"])), false);
  assert.equal(keyboardPause({ Escape: true }), true);
});

import {
  BIND_FIELDS,
  DEFAULT_BINDINGS,
  GP_A,
  GP_B,
  GP_DOWN,
  GP_LEFT,
  GP_RIGHT,
  GP_START,
  GP_UP,
  PLAYER_COUNT,
  STICK_DEADZONE,
} from "./constants.js";

export function zeroInput() {
  return { x: 0, y: 0, action: false, secondary: false, pause: false };
}

function hasCode(pressed, code) {
  if (!code) return false;
  if (pressed instanceof Set) return pressed.has(code);
  return !!pressed[code];
}

function normalizeStick(x, y) {
  const m = Math.hypot(x, y);
  if (m > 1) return [x / m, y / m];
  return [x, y];
}

/**
 * @param {Set<string>|Record<string, boolean>} pressed
 * @param {typeof DEFAULT_BINDINGS} [bindings]
 */
export function actionsFromKeyboard(pressed, bindings = DEFAULT_BINDINGS) {
  return bindings.slice(0, PLAYER_COUNT).map((b) => {
    let x = 0;
    let y = 0;
    if (hasCode(pressed, b.left)) x -= 1;
    if (hasCode(pressed, b.right)) x += 1;
    if (hasCode(pressed, b.up)) y -= 1;
    if (hasCode(pressed, b.down)) y += 1;
    [x, y] = normalizeStick(x, y);
    return {
      x,
      y,
      action: hasCode(pressed, b.action),
      secondary: hasCode(pressed, b.secondary),
      pause: false,
    };
  });
}

function buttonDown(buttons, index) {
  const btn = buttons && buttons[index];
  if (!btn) return false;
  if (typeof btn === "boolean") return btn;
  return !!(btn.pressed || (typeof btn.value === "number" && btn.value > 0.5));
}

function mapPad(pad) {
  const axes = pad.axes || [];
  let x = Number(axes[0]) || 0;
  let y = Number(axes[1]) || 0;
  if (!Number.isFinite(x)) x = 0;
  if (!Number.isFinite(y)) y = 0;
  const buttons = pad.buttons || [];
  let dx = 0;
  let dy = 0;
  if (buttonDown(buttons, GP_LEFT)) dx -= 1;
  if (buttonDown(buttons, GP_RIGHT)) dx += 1;
  if (buttonDown(buttons, GP_UP)) dy -= 1;
  if (buttonDown(buttons, GP_DOWN)) dy += 1;
  if (dx !== 0 || dy !== 0) {
    [x, y] = normalizeStick(dx, dy);
  } else {
    const m = Math.hypot(x, y);
    if (m < STICK_DEADZONE) {
      x = 0;
      y = 0;
    } else {
      const scaled = Math.min(1, (m - STICK_DEADZONE) / (1 - STICK_DEADZONE));
      x = (x / m) * scaled;
      y = (y / m) * scaled;
    }
  }
  return {
    x,
    y,
    action: buttonDown(buttons, GP_A),
    secondary: buttonDown(buttons, GP_B),
    pause: buttonDown(buttons, GP_START),
  };
}

/**
 * pads: length-4 array. Null / disconnected entries leave that player idle.
 * A connected pad overrides that player's keyboard in mergeInputs.
 */
export function readGamepads(pads) {
  const actions = [];
  const connected = [];
  for (let i = 0; i < PLAYER_COUNT; i++) {
    const pad = pads && pads[i];
    if (!pad || !pad.connected) {
      actions.push(zeroInput());
      connected.push(false);
    } else {
      actions.push(mapPad(pad));
      connected.push(true);
    }
  }
  return {
    actions,
    connected,
    pause: actions.some((a) => a.pause),
  };
}

/** Connected gamepads replace that player's keyboard sample. */
export function mergeInputs(keyboardActions, gamepadActions, connected) {
  const out = [];
  for (let i = 0; i < PLAYER_COUNT; i++) {
    if (connected && connected[i]) out.push({ ...gamepadActions[i] });
    else out.push({ ...(keyboardActions[i] || zeroInput()) });
  }
  return out;
}

export function keyboardPause(pressed) {
  return hasCode(pressed, "Escape");
}

export function sanitizeBindings(input) {
  const out = [];
  for (let i = 0; i < PLAYER_COUNT; i++) {
    const fallback = DEFAULT_BINDINGS[i];
    const src = input && input[i] ? input[i] : {};
    const row = {};
    for (const field of BIND_FIELDS) {
      const value = src[field];
      row[field] = typeof value === "string" && value.length > 0 ? value : fallback[field];
    }
    out.push(row);
  }
  return out;
}

const KEY_LABELS = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Slash: "/",
  Period: ".",
  Semicolon: ";",
  Quote: "'",
  NumpadEnter: "Num Enter",
  Space: "Space",
  Escape: "Esc",
  ShiftLeft: "L Shift",
  ShiftRight: "R Shift",
  ControlLeft: "L Ctrl",
  ControlRight: "R Ctrl",
  AltLeft: "L Alt",
  AltRight: "R Alt",
};

export function keyLabel(code) {
  if (!code) return "?";
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return "Num " + code.slice(6);
  return code;
}

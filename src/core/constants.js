/** Tunables for Hover Derby 4. Times are seconds; distances are world pixels. */

export const DT = 1 / 60;
export const PLAYER_COUNT = 4;
export const DEFAULT_ROUNDS = 3;
export const ROUND_OPTIONS = [1, 3, 5, 7];

export const RING_START = 360;
export const RING_SOFT = 140;
export const RING_MIN = 78;
export const SHRINK_PER_SEC = 4.6;
export const SHRINK_SUDDEN = 18;

export const CRAFT_RADIUS = 24;
export const MASS = 1;
export const HEAVY_MULT = 2.4;
export const ACCEL = 240;
export const MAX_SPEED = 210;
export const DRAG_KEEP = 0.5;
export const TURN_RATE = 12;
export const SPEED_HARD_CAP = 900;

export const BOOST_SPEED = 250;
export const BOOST_COOLDOWN = 1.35;
export const BOOST_UNCLAMP = 0.12;

export const PULSE_RADIUS = 120;
export const PULSE_IMPULSE = 230;
export const PULSE_COOLDOWN = 2.4;

export const NITRO_TIME = 3.2;
export const NITRO_ACCEL = 1.45;
export const NITRO_MAX = 1.4;
export const SHIELD_TIME = 3;
export const HEAVY_TIME = 4;

export const RESTITUTION = 1;
export const SPAWN_DIST = 0.4;
export const POWERUP_RADIUS = 16;
export const POWER_TYPES = ["nitro", "shield", "heavy"];
export const MAX_POWERUPS = 2;
export const POWER_SPAWN_INTERVAL = 4.2;
export const POWER_FIRST_SPAWN = 2.5;

export const STICK_DEADZONE = 0.2;

export const PLAYERS = [
  { name: "RUSH", color: "#FF3358", dark: "#4A0C1A" },
  { name: "AERO", color: "#3DB7FF", dark: "#062844" },
  { name: "JADE", color: "#5DFF4A", dark: "#0E3A12" },
  { name: "SOLAR", color: "#FFD23A", dark: "#3F3006" },
];

export const BIND_FIELDS = ["up", "down", "left", "right", "action", "secondary"];

export const DEFAULT_BINDINGS = [
  { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", action: "KeyF", secondary: "KeyG" },
  { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", action: "Slash", secondary: "Period" },
  { up: "KeyI", down: "KeyK", left: "KeyJ", right: "KeyL", action: "Semicolon", secondary: "Quote" },
  { up: "Numpad8", down: "Numpad5", left: "Numpad4", right: "Numpad6", action: "Numpad0", secondary: "NumpadEnter" },
];

export const GP_A = 0;
export const GP_B = 1;
export const GP_START = 9;
export const GP_UP = 12;
export const GP_DOWN = 13;
export const GP_LEFT = 14;
export const GP_RIGHT = 15;

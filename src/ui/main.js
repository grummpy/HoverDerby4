import { PLAYERS, ROUND_OPTIONS } from "../core/constants.js";
import {
  actionsFromKeyboard,
  mergeInputs,
  readGamepads,
  sanitizeBindings,
} from "../core/inputmap.js";
import { createMatch, nextRound, resolveInputs, stepMatch } from "../core/sim.js";
import { createAudio } from "./audio.js";
import { attachKeyboard, snapshotGamepads } from "./input.js";
import { draw } from "./render.js";
import { loadSettings, saveSettings } from "./storage.js";

const STEP = 1000 / 60;
const BIND_FIELDS = ["up", "down", "left", "right", "action", "secondary"];

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const keys = new Set();
const keyEdges = [];
const clicks = [];
const prevButtons = [[], [], [], []];

const audio = createAudio();
const settings = loadSettings();
audio.setVolume(settings.volume);
audio.setMuted(settings.muted);

const app = {
  screen: "title",
  settings,
  menuIndex: 0,
  joinSlots: ["bot", "bot", "bot", "bot"],
  match: null,
  pads: [null, null, null, null],
  padConnected: [false, false, false, false],
  padActions: [{}, {}, {}, {}],
  hits: [],
  particles: [],
  trails: [[], [], [], []],
  shake: 0,
  clock: 0,
  cover: null,
  icon: null,
  toast: "",
  toastT: 0,
  count: 3,
  countT: 0.7,
  bannerT: 0,
  goT: 0,
  settingsReturn: "title",
  remap: null,
  ctrlPlayer: 0,
  view: { w: 1280, h: 720, dpr: 1 },
  seedNudge: 1,
};

function loadImage(src) {
  const image = new Image();
  image.onload = () => {
    if (src.endsWith("cover.jpg")) app.cover = image;
    if (src.endsWith("icon.jpg")) app.icon = image;
  };
  image.src = src;
}

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  app.view = { w, h, dpr };
}

function cycleSlot(index) {
  const order = { human: "bot", bot: "off", off: "human" };
  app.joinSlots[index] = order[app.joinSlots[index]] || "bot";
  audio.ui();
}

function activeRacers() {
  return app.joinSlots.filter((kind) => kind !== "off").length;
}

function freshSeed() {
  app.seedNudge = (app.seedNudge + 1) >>> 0;
  const mixed = (Math.floor(performance.now()) ^ Math.imul(app.seedNudge, 997)) >>> 0;
  return mixed || 1;
}

function armHeld() {
  const keyboard = actionsFromKeyboard(keys, app.settings.bindings);
  const merged = mergeInputs(keyboard, app.padActions, app.padConnected);
  for (const craft of app.match.crafts) {
    const input = merged[craft.player] || {};
    craft.actionHeld = !!input.action;
    craft.secondaryHeld = !!input.secondary;
  }
}

function beginCountdown() {
  app.screen = "countdown";
  app.count = 3;
  app.countT = 0.7;
  app.trails = [[], [], [], []];
  app.particles = [];
  app.goT = 0;
  audio.countdown(3);
}

function startMatch() {
  if (activeRacers() < 2) {
    app.toast = "NEED 2 RACERS";
    app.toastT = 1.6;
    audio.ui();
    return;
  }
  app.match = createMatch({
    seed: freshSeed(),
    roundsToWin: app.settings.roundsToWin,
    slots: app.joinSlots.map((kind) => ({ kind })),
  });
  armHeld();
  beginCountdown();
}

function persist() {
  app.settings.bindings = sanitizeBindings(app.settings.bindings);
  saveSettings(app.settings);
  audio.setVolume(app.settings.volume);
  audio.setMuted(app.settings.muted);
}

function toggleMute() {
  app.settings.muted = !app.settings.muted;
  persist();
}

function burst(x, y, color, count, speed) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    app.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.35,
      max: 0.35,
      color,
    });
  }
  if (app.particles.length > 180) app.particles.splice(0, app.particles.length - 180);
}

function handleEvent(event) {
  if (event.type === "hit") {
    audio.hit();
    app.shake = Math.min(10, app.shake + 5);
    return;
  }
  if (event.type === "boost") {
    audio.boost();
    const craft = app.match.crafts[event.player];
    burst(craft.x, craft.y, PLAYERS[event.player].color, 8, 80);
    return;
  }
  if (event.type === "pulse") {
    audio.pulse();
    const craft = app.match.crafts[event.player];
    burst(craft.x, craft.y, "#7af7ff", 12, 140);
    return;
  }
  if (event.type === "pickup") {
    audio.pickup();
    return;
  }
  if (event.type === "ko") {
    audio.ko();
    const craft = app.match.crafts[event.player];
    burst(craft.x, craft.y, PLAYERS[event.player].color, 16, 160);
    app.shake = 8;
  }
}

function pollPads() {
  const pads = snapshotGamepads();
  app.pads = pads;
  const edges = {
    start: false,
    up: false,
    down: false,
    left: false,
    right: false,
    a: [false, false, false, false],
    b: [false, false, false, false],
  };
  for (let i = 0; i < 4; i++) {
    const pad = pads[i];
    const buttons = (pad && pad.buttons) || [];
    const was = prevButtons[i];
    const down = (index) => !!(buttons[index] && buttons[index].pressed);
    const edge = (index) => down(index) && !was[index];
    if (edge(9)) edges.start = true;
    if (edge(12)) edges.up = true;
    if (edge(13)) edges.down = true;
    if (edge(14)) edges.left = true;
    if (edge(15)) edges.right = true;
    if (edge(0)) edges.a[i] = true;
    if (edge(1)) edges.b[i] = true;
    prevButtons[i] = pad ? buttons.map((button) => !!(button && button.pressed)) : [];
  }
  const read = readGamepads(pads);
  app.padConnected = read.connected;
  app.padActions = read.actions;
  return edges;
}

function menuUp(list, pad) {
  return list.includes("ArrowUp") || list.includes("KeyW") || pad.up;
}

function menuDown(list, pad) {
  return list.includes("ArrowDown") || list.includes("KeyS") || pad.down;
}

function menuLeft(list, pad) {
  return list.includes("ArrowLeft") || list.includes("KeyA") || pad.left;
}

function menuRight(list, pad) {
  return list.includes("ArrowRight") || list.includes("KeyD") || pad.right;
}

function confirm(list, pad) {
  return list.includes("Enter") || list.includes("Space") || pad.start || pad.a.some(Boolean);
}

function go(screen, index = 0) {
  app.screen = screen;
  app.menuIndex = index;
  audio.ui();
}

function updateTitle(list, pad, clicked) {
  if (menuUp(list, pad)) app.menuIndex = Math.max(0, app.menuIndex - 1);
  if (menuDown(list, pad)) app.menuIndex = Math.min(1, app.menuIndex + 1);
  if (clicked.includes("title:start") || (confirm(list, pad) && app.menuIndex === 0)) {
    go("join");
    return;
  }
  if (clicked.includes("title:settings") || (confirm(list, pad) && app.menuIndex === 1)) {
    app.settingsReturn = "title";
    go("settings");
  }
}

function updateJoin(list, pad, clicked) {
  const bindings = app.settings.bindings;
  for (let i = 0; i < 4; i++) {
    if (list.includes(bindings[i].action) || pad.a[i]) {
      if (app.joinSlots[i] !== "human") audio.ui();
      app.joinSlots[i] = "human";
    } else if (list.includes(bindings[i].secondary) || pad.b[i]) {
      cycleSlot(i);
    }
  }
  if (clicked.includes("join:back") || list.includes("Escape")) {
    go("title");
    return;
  }
  if (clicked.includes("join:start") || list.includes("Enter") || list.includes("Space") || pad.start) {
    startMatch();
  }
}

function adjustSettings(dir) {
  if (app.menuIndex === 0) {
    app.settings.muted = false;
    app.settings.volume = Math.min(1, Math.max(0, Math.round((app.settings.volume + dir * 0.1) * 10) / 10));
    persist();
    audio.ui();
  } else if (app.menuIndex === 1) {
    const index = ROUND_OPTIONS.indexOf(app.settings.roundsToWin);
    const next = ROUND_OPTIONS[(index + (dir > 0 ? 1 : ROUND_OPTIONS.length - 1)) % ROUND_OPTIONS.length];
    app.settings.roundsToWin = next;
    persist();
    audio.ui();
  }
}

function updateSettings(list, pad, clicked) {
  const rows = 4;
  if (menuUp(list, pad)) app.menuIndex = (app.menuIndex + rows - 1) % rows;
  if (menuDown(list, pad)) app.menuIndex = (app.menuIndex + 1) % rows;
  if (clicked.includes("settings:volume")) app.menuIndex = 0;
  if (clicked.includes("settings:rounds")) app.menuIndex = 1;
  if (clicked.includes("settings:controls")) app.menuIndex = 2;
  if (clicked.includes("settings:back")) app.menuIndex = 3;
  if (menuLeft(list, pad)) adjustSettings(-1);
  if (menuRight(list, pad)) adjustSettings(1);
  const back = list.includes("Escape") || clicked.includes("settings:back") || (confirm(list, pad) && app.menuIndex === 3);
  if (back) {
    go(app.settingsReturn);
    return;
  }
  if (clicked.includes("settings:controls") || (confirm(list, pad) && app.menuIndex === 2)) {
    app.ctrlPlayer = 0;
    go("controls");
  }
}

function updateControls(list, pad, clicked) {
  if (menuUp(list, pad)) app.menuIndex = (app.menuIndex + BIND_FIELDS.length - 1) % BIND_FIELDS.length;
  if (menuDown(list, pad)) app.menuIndex = (app.menuIndex + 1) % BIND_FIELDS.length;
  if (menuLeft(list, pad)) app.ctrlPlayer = (app.ctrlPlayer + 3) % 4;
  if (menuRight(list, pad)) app.ctrlPlayer = (app.ctrlPlayer + 1) % 4;
  BIND_FIELDS.forEach((field, i) => {
    if (clicked.includes(`controls:${field}`)) app.menuIndex = i;
  });
  if (list.includes("Escape") || clicked.includes("controls:back")) {
    app.remap = null;
    go("settings");
    return;
  }
  if (confirm(list, pad) || clicked.some((id) => id.startsWith("controls:") && id !== "controls:back")) {
    app.remap = { player: app.ctrlPlayer, field: BIND_FIELDS[app.menuIndex] };
    audio.ui();
  }
}

function handleRemap(list) {
  if (!list.length) return;
  const code = list[0];
  if (code !== "Escape") {
    app.settings.bindings[app.remap.player][app.remap.field] = code;
    persist();
    audio.ui();
  }
  app.remap = null;
}

function updateCountdown(dt, list) {
  if (list.includes("Escape")) {
    app.match = null;
    go("join");
    return;
  }
  app.countT -= dt;
  if (app.countT > 0) return;
  if (app.count > 1) {
    app.count -= 1;
    app.countT = 0.7;
    audio.countdown(app.count);
    return;
  }
  if (app.count === 1) {
    app.count = 0;
    app.countT = 0.4;
    audio.go();
    return;
  }
  armHeld();
  app.screen = "play";
  app.goT = 0.4;
}

function updatePlay(dt, list, pad) {
  if (list.includes("Escape") || pad.start) {
    app.menuIndex = 0;
    app.screen = "pause";
    audio.ui();
    return;
  }
  const keyboard = actionsFromKeyboard(keys, app.settings.bindings);
  const merged = mergeInputs(keyboard, app.padActions, app.padConnected);
  const inputs = resolveInputs(app.match, merged, app.padConnected);
  stepMatch(app.match, inputs);
  for (const event of app.match.events) handleEvent(event);
  for (const craft of app.match.crafts) {
    if (!craft.active || !craft.alive) continue;
    const trail = app.trails[craft.player];
    trail.push({ x: craft.x, y: craft.y });
    if (trail.length > 14) trail.shift();
  }
  app.goT = Math.max(0, app.goT - dt);
  if (app.match.phase === "matchover") {
    app.menuIndex = 0;
    app.screen = "match";
    audio.win(true);
  } else if (app.match.phase === "roundover") {
    app.bannerT = 2.4;
    app.screen = "round";
    audio.win(false);
  }
}

function updatePause(list, pad, clicked) {
  const items = ["pause:resume", "pause:settings", "pause:quit"];
  if (menuUp(list, pad)) app.menuIndex = (app.menuIndex + 2) % 3;
  if (menuDown(list, pad)) app.menuIndex = (app.menuIndex + 1) % 3;
  items.forEach((id, i) => {
    if (clicked.includes(id)) app.menuIndex = i;
  });
  const pick = clicked.find((id) => items.includes(id));
  const chosen = pick || (confirm(list, pad) ? items[app.menuIndex] : null);
  if (list.includes("Escape") || pad.start) {
    app.screen = "play";
    audio.ui();
    return;
  }
  if (chosen === "pause:resume") {
    app.screen = "play";
    audio.ui();
  } else if (chosen === "pause:settings") {
    app.settingsReturn = "pause";
    go("settings");
  } else if (chosen === "pause:quit") {
    app.match = null;
    go("title", 0);
  }
}

function updateRound(dt, list, pad) {
  app.bannerT -= dt;
  const skip = list.includes("Enter") || list.includes("Space") || pad.start || pad.a.some(Boolean);
  if (app.bannerT > 0 && !skip) return;
  nextRound(app.match);
  beginCountdown();
}

function updateMatch(list, pad, clicked) {
  if (menuLeft(list, pad) || menuUp(list, pad)) app.menuIndex = 0;
  if (menuRight(list, pad) || menuDown(list, pad)) app.menuIndex = 1;
  if (clicked.includes("match:rematch")) app.menuIndex = 0;
  if (clicked.includes("match:title")) app.menuIndex = 1;
  if (list.includes("Escape") || clicked.includes("match:title") || (confirm(list, pad) && app.menuIndex === 1)) {
    app.match = null;
    go("title", 0);
    return;
  }
  if (clicked.includes("match:rematch") || (confirm(list, pad) && app.menuIndex === 0)) {
    startMatch();
  }
}

function decayJuice(dt) {
  app.shake = Math.max(0, app.shake - dt * 28);
  for (const speck of app.particles) {
    speck.life -= dt;
    speck.x += speck.vx * dt;
    speck.y += speck.vy * dt;
  }
  app.particles = app.particles.filter((speck) => speck.life > 0);
  if (app.toastT > 0) app.toastT -= dt;
}

function takeClicks() {
  const points = clicks.splice(0, clicks.length);
  const ids = [];
  for (const point of points) {
    for (let i = app.hits.length - 1; i >= 0; i--) {
      const box = app.hits[i];
      if (point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h) {
        ids.push(box.id);
        break;
      }
    }
  }
  return ids;
}

function tick(dt) {
  app.clock += dt;
  const list = keyEdges.splice(0, keyEdges.length);
  const pad = pollPads();
  const clicked = takeClicks();
  decayJuice(dt);
  if (list.length || pad.start || pad.a.some(Boolean) || clicked.length) audio.unlock();
  if (app.remap) {
    handleRemap(list);
    audio.pump();
    return;
  }
  if (list.includes("KeyM")) toggleMute();
  if (app.screen === "title") updateTitle(list, pad, clicked);
  else if (app.screen === "join") updateJoin(list, pad, clicked);
  else if (app.screen === "settings") updateSettings(list, pad, clicked);
  else if (app.screen === "controls") updateControls(list, pad, clicked);
  else if (app.screen === "countdown") updateCountdown(dt, list);
  else if (app.screen === "play") updatePlay(dt, list, pad);
  else if (app.screen === "pause") updatePause(list, pad, clicked);
  else if (app.screen === "round") updateRound(dt, list, pad);
  else if (app.screen === "match") updateMatch(list, pad, clicked);
  audio.pump();
}

function pointerPos(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) * app.view.w) / Math.max(1, rect.width),
    y: ((event.clientY - rect.top) * app.view.h) / Math.max(1, rect.height),
  };
}

attachKeyboard(
  (event) => {
    keys.add(event.code);
    keyEdges.push(event.code);
  },
  (event) => {
    if (!event) {
      keys.clear();
      return;
    }
    keys.delete(event.code);
  },
);

canvas.addEventListener("pointerdown", (event) => {
  clicks.push(pointerPos(event));
  audio.unlock();
});
canvas.addEventListener("pointermove", (event) => {
  const point = pointerPos(event);
  const hot = app.hits.some(
    (box) => point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h,
  );
  canvas.style.cursor = hot ? "pointer" : "default";
});

window.addEventListener("resize", resize);
resize();
loadImage("assets/cover.jpg");
loadImage("assets/icon.jpg");
canvas.focus();

let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let delta = now - last;
  last = now;
  if (delta > 100) delta = 100;
  acc += delta;
  let steps = 0;
  while (acc >= STEP && steps < 5) {
    tick(STEP / 1000);
    acc -= STEP;
    steps += 1;
  }
  draw(ctx, app);
}
requestAnimationFrame(frame);

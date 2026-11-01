import {
  BIND_FIELDS,
  BOOST_COOLDOWN,
  PLAYERS,
  RING_MIN,
  RING_SOFT,
  RING_START,
} from "../core/constants.js";
import { keyLabel } from "../core/inputmap.js";

const STARS = Array.from({ length: 90 }, (_, i) => ({
  x: ((i * 97) % 1000) / 1000,
  y: ((i * 53) % 1000) / 1000,
  s: (i % 3) * 0.6 + 0.6,
}));

const FIELD_LABEL = {
  up: "UP",
  down: "DOWN",
  left: "LEFT",
  right: "RIGHT",
  action: "BOOST",
  secondary: "PULSE",
};

function font(ctx, size, weight = 700) {
  ctx.font = `${weight} ${Math.round(size)}px Trebuchet MS, Segoe UI, sans-serif`;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function hit(app, id, x, y, w, h) {
  app.hits.push({ id, x, y, w, h });
}

function cover(ctx, img, w, h) {
  if (!img) return;
  const ir = img.width / img.height;
  const cr = w / Math.max(1, h);
  let dw;
  let dh;
  if (ir > cr) {
    dh = h;
    dw = h * ir;
  } else {
    dw = w;
    dh = w / ir;
  }
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function backdrop(ctx, app) {
  const { w, h } = app.view;
  ctx.fillStyle = "#07060f";
  ctx.fillRect(0, 0, w, h);
  cover(ctx, app.cover, w, h);
  ctx.fillStyle = "rgba(7, 6, 16, 0.55)";
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, h * 0.35, 0, h);
  g.addColorStop(0, "rgba(7, 6, 16, 0)");
  g.addColorStop(1, "rgba(7, 6, 16, 0.88)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function voidBackground(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, Math.max(w, h) * 0.7);
  g.addColorStop(0, "#1a1030");
  g.addColorStop(1, "#07060f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(220, 220, 255, 0.75)";
  for (const star of STARS) {
    ctx.globalAlpha = 0.25 + (star.s % 0.5);
    ctx.fillRect(star.x * w, star.y * h, star.s, star.s);
  }
  ctx.globalAlpha = 1;
}

function button(ctx, app, label, x, y, w, h, id, focused) {
  hit(app, id, x, y, w, h);
  ctx.save();
  roundRect(ctx, x, y, w, h, 12);
  ctx.fillStyle = focused ? "rgba(255, 43, 214, 0.28)" : "rgba(8, 6, 20, 0.72)";
  ctx.fill();
  ctx.lineWidth = focused ? 3 : 2;
  ctx.strokeStyle = focused ? "#ff4ad8" : "rgba(180, 220, 255, 0.45)";
  ctx.shadowColor = focused ? "#ff4ad8" : "transparent";
  ctx.shadowBlur = focused ? 16 : 0;
  ctx.stroke();
  ctx.shadowBlur = 0;
  font(ctx, Math.min(28, h * 0.42));
  ctx.fillStyle = "#f7f4ff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  ctx.restore();
}

function camera(app) {
  const { w, h } = app.view;
  const scale = (Math.min(w, h) * 0.78) / (RING_START * 2);
  const mag = app.shake || 0;
  const ox = w / 2 + Math.sin(app.clock * 40) * mag;
  const oy = h / 2 + 12 + Math.cos(app.clock * 35) * mag;
  return {
    scale,
    x: (wx) => ox + wx * scale,
    y: (wy) => oy + wy * scale,
    ox,
    oy,
  };
}

function ringStyle(radius) {
  const span = RING_START - RING_MIN;
  const t = 1 - (radius - RING_MIN) / span;
  if (t > 0.72) return "#ff5a1f";
  if (t > 0.4) return "#ff2bd6";
  return "#c86bff";
}

function drawCraft(ctx, x, y, angle, r, color, alive, boosting) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = alive ? 1 : 0.28;
  if (boosting && alive) {
    const flame = ctx.createLinearGradient(-r * 0.2, 0, -r * 2.1, 0);
    flame.addColorStop(0, color);
    flame.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(-r * 0.35, 0);
    ctx.lineTo(-r * 2.0, r * 0.42);
    ctx.lineTo(-r * 2.0, -r * 0.42);
    ctx.fill();
  }
  ctx.fillStyle = "#140818";
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.14);
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.moveTo(r * 1.45, 0);
  ctx.lineTo(-r * 0.95, r * 0.78);
  ctx.quadraticCurveTo(-r * 0.35, 0, -r * 0.95, -r * 0.78);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(r * 0.55, 0);
  ctx.lineTo(-r * 0.05, r * 0.26);
  ctx.lineTo(-r * 0.05, -r * 0.26);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPowerup(ctx, cam, power, clock) {
  const x = cam.x(power.x);
  const y = cam.y(power.y);
  const s = Math.max(8, power.radius * cam.scale);
  const spin = clock * 2.2;
  const color = power.type === "nitro" ? "#ffb020" : power.type === "shield" ? "#7af7ff" : "#ffffff";
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.strokeStyle = color;
  ctx.fillStyle = "rgba(8, 6, 20, 0.8)";
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.72, 0);
  ctx.lineTo(0, s);
  ctx.lineTo(-s * 0.72, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawArena(ctx, app) {
  const { w, h } = app.view;
  const match = app.match;
  voidBackground(ctx, w, h);
  if (!match) return;
  const cam = camera(app);
  const ringR = match.ring.radius * cam.scale;
  const color = ringStyle(match.ring.radius);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cam.ox, cam.oy, ringR, 0, Math.PI * 2);
  const fill = ctx.createRadialGradient(cam.ox, cam.oy, ringR * 0.1, cam.ox, cam.oy, ringR);
  fill.addColorStop(0, "rgba(70, 30, 110, 0.35)");
  fill.addColorStop(1, "rgba(20, 10, 40, 0.15)");
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = "rgba(190, 140, 255, 0.09)";
  ctx.lineWidth = 1;
  const gap = 36 * cam.scale;
  const left = cam.ox - ringR;
  const top = cam.oy - ringR;
  for (let x = left; x < cam.ox + ringR; x += gap) {
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, cam.oy + ringR);
    ctx.stroke();
  }
  for (let y = top; y < cam.oy + ringR; y += gap) {
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(cam.ox + ringR, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.arc(cam.ox, cam.oy, ringR, 0, Math.PI * 2, true);
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fill("evenodd");
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cam.ox, cam.oy, ringR, 0, Math.PI * 2);
  ctx.lineWidth = match.ring.radius <= RING_SOFT ? 12 : 8;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 22;
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#f5fbff";
  ctx.shadowColor = "#f5fbff";
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.restore();

  for (const craft of match.crafts) {
    if (!craft.active) continue;
    const trail = app.trails[craft.player] || [];
    ctx.fillStyle = PLAYERS[craft.player].color;
    trail.forEach((p, i) => {
      ctx.globalAlpha = (i / trail.length) * 0.35;
      ctx.beginPath();
      ctx.arc(cam.x(p.x), cam.y(p.y), Math.max(2, craft.radius * cam.scale * 0.35), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  for (const power of match.powerups) drawPowerup(ctx, cam, power, app.clock);

  for (const speck of app.particles) {
    ctx.globalAlpha = Math.max(0, speck.life / speck.max);
    ctx.fillStyle = speck.color;
    ctx.beginPath();
    ctx.arc(cam.x(speck.x), cam.y(speck.y), 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const craft of match.crafts) {
    if (!craft.active) continue;
    const px = cam.x(craft.x);
    const py = cam.y(craft.y);
    const pr = craft.radius * cam.scale;
    const boosting = craft.alive && craft.boostCd > BOOST_COOLDOWN - 0.3;
    drawCraft(ctx, px, py, craft.facing, pr, PLAYERS[craft.player].color, craft.alive, boosting);
    if (craft.shield > 0 && craft.alive) {
      ctx.beginPath();
      ctx.arc(px, py, pr * 1.8, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(122, 247, 255, 0.85)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (craft.heavy > 0 && craft.alive) {
      ctx.beginPath();
      ctx.arc(px, py, pr * 1.35, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    font(ctx, Math.max(11, pr * 0.7), 700);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = craft.alive ? PLAYERS[craft.player].color : "rgba(255,255,255,0.35)";
    const tag = craft.kind === "bot" ? " BOT" : "";
    ctx.fillText(PLAYERS[craft.player].name + tag, px, py + pr + 6);
  }

  drawHud(ctx, app);
}

function drawHud(ctx, app) {
  const { w, h } = app.view;
  const match = app.match;
  const u = Math.min(w, h) / 800;
  font(ctx, 18 * u, 700);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#f4f1ff";
  ctx.fillText(`ROUND ${match.round}   ·   FIRST TO ${match.roundsToWin}`, w / 2, 16);

  const active = match.crafts.filter((c) => c.active);
  const chipW = Math.min(150, (w - 40) / active.length - 8);
  const total = active.length * chipW + (active.length - 1) * 8;
  let x = (w - total) / 2;
  const y = 46 * u + 8;
  for (const craft of active) {
    const info = PLAYERS[craft.player];
    ctx.save();
    roundRect(ctx, x, y, chipW, 36 * u + 8, 8);
    ctx.fillStyle = craft.alive ? "rgba(8,6,20,0.72)" : "rgba(8,6,20,0.4)";
    ctx.fill();
    ctx.strokeStyle = info.color;
    ctx.globalAlpha = craft.alive ? 1 : 0.4;
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (app.padConnected[craft.player]) {
      font(ctx, 10 * u, 700);
      ctx.fillStyle = info.color;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("PAD", x + 8, y + (36 * u + 8) / 2);
    }
    font(ctx, 14 * u, 700);
    ctx.fillStyle = info.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${info.name}  ${match.scores[craft.player]}`, x + chipW / 2 + (app.padConnected[craft.player] ? 8 : 0), y + (36 * u + 8) / 2);
    ctx.restore();
    const ready = craft.boostCd <= 0;
    ctx.fillStyle = ready ? info.color : "rgba(255,255,255,0.2)";
    roundRect(ctx, x + 10, y + 36 * u + 12, chipW - 20, 4, 2);
    ctx.fill();
    if (!ready) {
      const frac = 1 - craft.boostCd / BOOST_COOLDOWN;
      ctx.fillStyle = info.color;
      roundRect(ctx, x + 10, y + 36 * u + 12, (chipW - 20) * Math.max(0, Math.min(1, frac)), 4, 2);
      ctx.fill();
    }
    x += chipW + 8;
  }

  const humans = match.crafts.filter((c) => c.active && c.kind === "human");
  if (app.screen === "play" && humans.length && humans.every((c) => !c.alive) && match.phase === "play") {
    font(ctx, 22 * u, 700);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffd6f5";
    ctx.fillText("WRECKED — still in play", w / 2, h * 0.78);
  }

  font(ctx, 13 * u, 600);
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "rgba(244,241,255,0.7)";
  ctx.fillText(app.settings.muted ? "MUTED  ·  M" : "M MUTE", 16, h - 14);
  ctx.textAlign = "right";
  ctx.fillText("ESC PAUSE", w - 16, h - 14);

  const pct = Math.round((match.ring.radius / RING_START) * 100);
  ctx.textAlign = "center";
  ctx.fillStyle = match.ring.radius <= RING_SOFT ? "#ffb089" : "rgba(244,241,255,0.7)";
  ctx.fillText(`RING ${pct}%`, w / 2, h - 14);
}

function drawTitle(ctx, app) {
  const { w, h } = app.view;
  backdrop(ctx, app);
  const u = Math.min(w, h) / 800;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  font(ctx, 18 * u, 700);
  ctx.fillStyle = "#9ad7ff";
  ctx.fillText("LOCAL 4-PLAYER ARCADE", w / 2, h * 0.58);
  font(ctx, 68 * u, 800);
  ctx.fillStyle = "#f7f4ff";
  ctx.shadowColor = "#ff2bd6";
  ctx.shadowBlur = 24;
  ctx.fillText("HOVER DERBY", w / 2, h * 0.67);
  ctx.shadowBlur = 0;
  font(ctx, 22 * u, 600);
  ctx.fillStyle = "#d7c6ff";
  ctx.fillText("RING-OUT BUMPER DERBY", w / 2, h * 0.74);

  const bw = Math.min(280, w * 0.4);
  const bh = 52 * u;
  const labels = ["START", "SETTINGS"];
  const ids = ["title:start", "title:settings"];
  labels.forEach((label, i) => {
    const x = w / 2 - bw / 2;
    const y = h * 0.8 + i * (bh + 12);
    button(ctx, app, label, x, y, bw, bh, ids[i], app.menuIndex === i);
  });
  const blink = 0.45 + Math.sin(app.clock * 4) * 0.35;
  font(ctx, 14 * u, 700);
  ctx.fillStyle = `rgba(255, 255, 255, ${blink})`;
  ctx.fillText("PRESS ENTER  /  START", w / 2, h - 28 * u);
}

function drawJoin(ctx, app) {
  const { w, h } = app.view;
  backdrop(ctx, app);
  const u = Math.min(w, h) / 800;
  font(ctx, 36 * u, 800);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f7f4ff";
  ctx.fillText("WHO'S RIDING?", w / 2, 48 * u + 10);
  font(ctx, 15 * u, 600);
  ctx.fillStyle = "#c9b7ef";
  ctx.fillText("ACTION JOINS   ·   SECONDARY CYCLES BOT / OFF   ·   ENTER STARTS", w / 2, 84 * u + 10);

  const gap = 14;
  const cols = w >= 980 ? 4 : 2;
  const rows = cols === 4 ? 1 : 2;
  const cardW = Math.min(240, (w - gap * (cols + 1)) / cols);
  const cardH = Math.min(230, (h * 0.55) / rows);
  const gridW = cols * cardW + (cols - 1) * gap;
  const gridH = rows * cardH + (rows - 1) * gap;
  const originX = (w - gridW) / 2;
  const originY = (h - gridH) / 2 - 10;

  app.joinSlots.forEach((kind, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = originX + col * (cardW + gap);
    const y = originY + row * (cardH + gap);
    const info = PLAYERS[i];
    const b = app.settings.bindings[i];
    ctx.save();
    roundRect(ctx, x, y, cardW, cardH, 16);
    ctx.fillStyle = kind === "off" ? "rgba(8,6,20,0.45)" : "rgba(8,6,20,0.78)";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = kind === "off" ? "rgba(255,255,255,0.2)" : info.color;
    ctx.shadowColor = kind === "off" ? "transparent" : info.color;
    ctx.shadowBlur = kind === "human" ? 16 : 0;
    ctx.stroke();
    ctx.shadowBlur = 0;
    font(ctx, 14 * u, 700);
    ctx.fillStyle = info.color;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`P${i + 1}`, x + 16, y + 14);
    if (app.padConnected[i]) {
      ctx.textAlign = "right";
      ctx.fillText("PAD", x + cardW - 16, y + 14);
    }
    font(ctx, 28 * u, 800);
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.fillText(info.name, x + cardW / 2, y + 48);
    font(ctx, 18 * u, 700);
    const status = kind === "human" ? "READY" : kind === "bot" ? "BOT" : "OFF";
    ctx.fillStyle = kind === "human" ? info.color : kind === "bot" ? "#d7c6ff" : "rgba(255,255,255,0.4)";
    ctx.fillText(status, x + cardW / 2, y + cardH * 0.48);
    font(ctx, 13 * u, 600);
    ctx.fillStyle = "rgba(244,241,255,0.8)";
    ctx.fillText(`BOOST  ${keyLabel(b.action)}`, x + cardW / 2, y + cardH * 0.68);
    ctx.fillText(`PULSE  ${keyLabel(b.secondary)}`, x + cardW / 2, y + cardH * 0.8);
    ctx.restore();
  });

  if (app.toastT > 0) {
    font(ctx, 22 * u, 800);
    ctx.fillStyle = "#ffb089";
    ctx.textAlign = "center";
    ctx.fillText(app.toast, w / 2, originY + gridH + 28);
  }

  const bw = 180;
  const bh = 46;
  button(ctx, app, "BACK", w / 2 - bw - 8, h - 70, bw, bh, "join:back", false);
  button(ctx, app, "START", w / 2 + 8, h - 70, bw, bh, "join:start", true);
}

function drawSettings(ctx, app) {
  const { w, h } = app.view;
  backdrop(ctx, app);
  const u = Math.min(w, h) / 800;
  font(ctx, 40 * u, 800);
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.fillText("SETTINGS", w / 2, 70 * u);

  const rows = [
    { id: "settings:volume", label: "VOLUME", value: app.settings.muted ? "MUTED" : `${Math.round(app.settings.volume * 100)}%` },
    { id: "settings:rounds", label: "FIRST TO", value: String(app.settings.roundsToWin) },
    { id: "settings:controls", label: "CONTROLS", value: "REMAP" },
    { id: "settings:back", label: "BACK", value: "" },
  ];
  const bw = Math.min(460, w * 0.7);
  const bh = 54 * u;
  rows.forEach((row, i) => {
    const x = w / 2 - bw / 2;
    const y = h * 0.28 + i * (bh + 12);
    const text = row.value ? `${row.label}    ${row.value}` : row.label;
    button(ctx, app, text, x, y, bw, bh, row.id, app.menuIndex === i);
  });
  font(ctx, 14 * u, 600);
  ctx.fillStyle = "#c9b7ef";
  ctx.fillText("LEFT / RIGHT ADJUST    ·    ENTER CONFIRMS    ·    ESC BACK", w / 2, h - 36);
}

function drawControls(ctx, app) {
  const { w, h } = app.view;
  backdrop(ctx, app);
  const u = Math.min(w, h) / 800;
  const player = app.ctrlPlayer;
  const info = PLAYERS[player];
  font(ctx, 36 * u, 800);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = info.color;
  ctx.fillText(`P${player + 1}  ${info.name}`, w / 2, 64 * u);
  font(ctx, 14 * u, 600);
  ctx.fillStyle = "#c9b7ef";
  ctx.fillText("LEFT / RIGHT CHANGE RIDER    ·    ENTER REBINDS    ·    ESC BACK", w / 2, 96 * u);
  ctx.fillStyle = "#9ad7ff";
  ctx.fillText("A CONNECTED PAD OVERRIDES THAT RIDER'S KEYBOARD", w / 2, 118 * u);

  const bw = Math.min(420, w * 0.72);
  const bh = 42 * u + 8;
  BIND_FIELDS.forEach((field, i) => {
    const x = w / 2 - bw / 2;
    const y = 150 * u + i * (bh + 8);
    const listening = app.remap && app.remap.player === player && app.remap.field === field;
    const value = listening ? "PRESS A KEY" : keyLabel(app.settings.bindings[player][field]);
    button(ctx, app, `${FIELD_LABEL[field]}      ${value}`, x, y, bw, bh, `controls:${field}`, app.menuIndex === i || listening);
  });
  const backY = h - 92;
  button(ctx, app, "BACK", w / 2 - 100, backY, 200, 46, "controls:back", false);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  font(ctx, 13 * u, 600);
  ctx.fillStyle = "#9ad7ff";
  ctx.fillText("GAMEPAD: STICK / D-PAD · A BOOST · B PULSE · START PAUSE", w / 2, backY + 64);
}

function drawCountdown(ctx, app) {
  drawArena(ctx, app);
  const { w, h } = app.view;
  const label = app.count > 0 ? String(app.count) : "GO";
  font(ctx, app.count > 0 ? 140 : 120, 800);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.shadowColor = "#7af7ff";
  ctx.shadowBlur = 30;
  ctx.fillText(label, w / 2, h / 2);
  ctx.shadowBlur = 0;
}

function drawPause(ctx, app) {
  drawArena(ctx, app);
  const { w, h } = app.view;
  ctx.fillStyle = "rgba(5, 4, 12, 0.62)";
  ctx.fillRect(0, 0, w, h);
  font(ctx, 48, 800);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.fillText("PAUSED", w / 2, h * 0.28);
  const items = [
    ["RESUME", "pause:resume"],
    ["SETTINGS", "pause:settings"],
    ["QUIT TO TITLE", "pause:quit"],
  ];
  const bw = Math.min(320, w * 0.5);
  items.forEach((item, i) => {
    button(ctx, app, item[0], w / 2 - bw / 2, h * 0.4 + i * 64, bw, 52, item[1], app.menuIndex === i);
  });
}

function drawRound(ctx, app) {
  drawArena(ctx, app);
  const { w, h } = app.view;
  const winner = app.match.roundWinner;
  const info = PLAYERS[winner];
  ctx.fillStyle = "rgba(5, 4, 12, 0.45)";
  ctx.fillRect(0, 0, w, h);
  font(ctx, Math.min(64, w / 14), 800);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = info.color;
  ctx.shadowColor = info.color;
  ctx.shadowBlur = 20;
  ctx.fillText(`${info.name} TAKES THE ROUND`, w / 2, h / 2 - 10);
  ctx.shadowBlur = 0;
  font(ctx, 20, 600);
  ctx.fillStyle = "#f4f1ff";
  ctx.fillText("ENTER TO CONTINUE", w / 2, h / 2 + 48);
}

function drawMatch(ctx, app) {
  const { w, h } = app.view;
  backdrop(ctx, app);
  const match = app.match;
  const winner = PLAYERS[match.matchWinner];
  const u = Math.min(w, h) / 800;
  font(ctx, 28 * u, 700);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#d7c6ff";
  ctx.fillText("MATCH COMPLETE", w / 2, h * 0.16);
  font(ctx, 52 * u, 800);
  ctx.fillStyle = winner.color;
  ctx.shadowColor = winner.color;
  ctx.shadowBlur = 18;
  ctx.fillText(`${winner.name} WINS`, w / 2, h * 0.24);
  ctx.shadowBlur = 0;

  const rows = match.crafts
    .filter((c) => c.active)
    .map((c) => ({ player: c.player, score: match.scores[c.player], kind: c.kind }))
    .sort((a, b) => b.score - a.score || a.player - b.player);
  rows.forEach((row, i) => {
    const info = PLAYERS[row.player];
    font(ctx, 26 * u, 700);
    ctx.fillStyle = info.color;
    const kind = row.kind === "bot" ? "  BOT" : "";
    ctx.fillText(`${i + 1}.  ${info.name}${kind}    ${row.score}`, w / 2, h * 0.36 + i * 40 * u);
  });

  const bw = 200;
  button(ctx, app, "REMATCH", w / 2 - bw - 8, h * 0.72, bw, 52, "match:rematch", app.menuIndex === 0);
  button(ctx, app, "TITLE", w / 2 + 8, h * 0.72, bw, 52, "match:title", app.menuIndex === 1);
}

export function draw(ctx, app) {
  const { w, h, dpr } = app.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  app.hits.length = 0;
  if (app.screen === "title") drawTitle(ctx, app);
  else if (app.screen === "join") drawJoin(ctx, app);
  else if (app.screen === "settings") drawSettings(ctx, app);
  else if (app.screen === "controls") drawControls(ctx, app);
  else if (app.screen === "countdown") drawCountdown(ctx, app);
  else if (app.screen === "play") {
    drawArena(ctx, app);
    if (app.goT > 0) {
      font(ctx, 90, 800);
      ctx.globalAlpha = Math.min(1, app.goT * 2);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.fillText("GO", w / 2, h / 2);
      ctx.globalAlpha = 1;
    }
  } else if (app.screen === "pause") drawPause(ctx, app);
  else if (app.screen === "round") drawRound(ctx, app);
  else if (app.screen === "match") drawMatch(ctx, app);

  if (app.remap) {
    ctx.fillStyle = "rgba(5, 4, 12, 0.35)";
    ctx.fillRect(0, 0, w, h);
  }
}

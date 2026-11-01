import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

test("arcade.json matches the manifest and points at real files", () => {
  const manifest = JSON.parse(read("arcade.json"));
  assert.deepEqual(manifest, {
    name: "Hover Derby 4",
    id: "hoverderby4",
    icon: "assets/icon.jpg",
    cover: "assets/cover.jpg",
    launch: {
      mac: "./launch-mac.command",
      windows: "launch-windows.bat",
      linux: "./launch-linux.sh",
      web: "index.html",
    },
    players: 4,
    port: 8802,
    minPlayers: 1,
    input: ["keyboard", "gamepad"],
    version: "1.0.0",
  });
  for (const rel of [manifest.icon, manifest.cover, manifest.launch.web]) {
    assert.equal(fs.existsSync(path.join(root, rel)), true, rel);
  }
  for (const rel of Object.values(manifest.launch)) {
    const file = rel.replace(/^\.\//, "");
    assert.equal(fs.existsSync(path.join(root, file)), true, file);
  }
});

test("launchers start the server and explain a missing Python 3", () => {
  for (const file of ["launch-linux.sh", "launch-mac.command", "launch-windows.bat"]) {
    const text = read(file);
    assert.match(text, /Python 3/);
    assert.match(text, /server\.py/);
  }
  for (const file of ["launch-linux.sh", "launch-mac.command"]) {
    const mode = fs.statSync(path.join(root, file)).mode;
    assert.ok(mode & 0o111, `${file} should be executable`);
  }
});

test("the page is a local canvas module and the server reads arcade.json", () => {
  const html = read("index.html");
  assert.match(html, /<canvas/);
  assert.match(html, /src\/ui\/main\.js/);
  assert.match(html, /Hover Derby 4/);
  assert.doesNotMatch(html, /https?:\/\//);
  const server = read("server.py");
  assert.match(server, /127\.0\.0\.1/);
  assert.match(server, /arcade\.json/);
  assert.equal(fs.existsSync(path.join(root, "src", "ui", "main.js")), true);
  assert.equal(fs.existsSync(path.join(root, "src", "core", "sim.js")), true);
});

test("core modules stay free of DOM, canvas, and Math.random", () => {
  const dir = path.join(root, "src", "core");
  const files = fs.readdirSync(dir).filter((name) => name.endsWith(".js"));
  assert.ok(files.length >= 6);
  for (const name of files) {
    const text = read(path.join("src", "core", name));
    assert.doesNotMatch(text, /Math\.random/);
    assert.doesNotMatch(text, /localStorage/);
    assert.doesNotMatch(text, /\bdocument\b/);
    assert.doesNotMatch(text, /\bwindow\b/);
    assert.doesNotMatch(text, /\bcanvas\b/);
  }
});

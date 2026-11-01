/** Browser keyboard + Gamepad API snapshots. Mapping itself lives in core. */

export function attachKeyboard(onDown, onUp) {
  const down = (event) => {
    if (event.repeat) return;
    if (event.code === "Tab" || event.code.startsWith("Arrow") || event.code === "Space") {
      event.preventDefault();
    }
    onDown(event);
  };
  const up = (event) => onUp(event);
  const blur = () => onUp(null);
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
  };
}

export function snapshotGamepads() {
  const source = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
  const pads = [null, null, null, null];
  for (let i = 0; i < 4; i++) {
    const pad = source && source[i];
    if (!pad || !pad.connected) continue;
    const buttons = [];
    for (let b = 0; b < pad.buttons.length; b++) {
      const button = pad.buttons[b];
      buttons.push({ pressed: !!(button && (button.pressed || button.value > 0.5)) });
    }
    pads[i] = {
      connected: true,
      axes: [pad.axes[0] || 0, pad.axes[1] || 0, pad.axes[2] || 0, pad.axes[3] || 0],
      buttons,
    };
  }
  return pads;
}

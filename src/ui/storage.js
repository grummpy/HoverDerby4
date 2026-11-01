import { DEFAULT_ROUNDS, ROUND_OPTIONS } from "../core/constants.js";
import { sanitizeBindings } from "../core/inputmap.js";

const KEY = "hoverderby4:v1";

export function defaultSettings() {
  return {
    volume: 0.8,
    muted: false,
    roundsToWin: DEFAULT_ROUNDS,
    bindings: sanitizeBindings(null),
  };
}

export function loadSettings() {
  const base = defaultSettings();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const data = JSON.parse(raw);
    const volume = Number(data.volume);
    const rounds = Number(data.roundsToWin);
    return {
      volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : base.volume,
      muted: !!data.muted,
      roundsToWin: ROUND_OPTIONS.includes(rounds) ? rounds : base.roundsToWin,
      bindings: sanitizeBindings(data.bindings),
    };
  } catch {
    return base;
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        volume: settings.volume,
        muted: settings.muted,
        roundsToWin: settings.roundsToWin,
        bindings: settings.bindings,
      }),
    );
  } catch {
    /* private mode and full storage still leave the session playable */
  }
}

/** Live Web Audio synthesis. No audio files. */

const LEAD = [0, 3, 7, 10, 12, 10, 7, 3, 5, 8, 7, 3, 2, 0, 3, 7];
const BASS = [-12, -12, -9, -9, -5, -5, -8, -8];
const STEP = 60 / 136 / 2;

function midi(semi) {
  return 220 * 2 ** (semi / 12);
}

export function createAudio() {
  const state = {
    ctx: null,
    master: null,
    sfx: null,
    musicBus: null,
    noise: null,
    volume: 0.8,
    muted: false,
    music: false,
    nextTime: 0,
    stepIndex: 0,
  };

  function ensure() {
    if (state.ctx) return state.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const master = ctx.createGain();
    const sfx = ctx.createGain();
    const musicBus = ctx.createGain();
    sfx.gain.value = 0.9;
    musicBus.gain.value = 0.22;
    sfx.connect(master);
    musicBus.connect(master);
    master.connect(ctx.destination);
    const len = ctx.sampleRate;
    const noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    state.ctx = ctx;
    state.master = master;
    state.sfx = sfx;
    state.musicBus = musicBus;
    state.noise = noise;
    applyGain();
    return ctx;
  }

  function applyGain() {
    if (!state.master || !state.ctx) return;
    const value = state.muted ? 0 : state.volume;
    state.master.gain.cancelScheduledValues(state.ctx.currentTime);
    state.master.gain.setValueAtTime(value, state.ctx.currentTime);
  }

  function tone(bus, { type = "square", freq = 440, freq2 = null, t, dur = 0.15, gain = 0.2 }) {
    const ctx = state.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, freq), t);
    if (freq2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq2), t + dur);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp);
    amp.connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  function burst(t, dur, gain) {
    const ctx = state.ctx;
    if (!ctx || !state.noise) return;
    const src = ctx.createBufferSource();
    const amp = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    src.buffer = state.noise;
    filter.type = "highpass";
    filter.frequency.value = 400;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(state.sfx);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function now() {
    const ctx = ensure();
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx ? ctx.currentTime : 0;
  }

  return {
    setVolume(volume) {
      state.volume = volume;
      applyGain();
    },
    setMuted(muted) {
      state.muted = muted;
      if (muted) state.nextTime = 0;
      applyGain();
    },
    unlock() {
      const ctx = ensure();
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();
      state.music = true;
      if (!state.nextTime || state.nextTime < ctx.currentTime) state.nextTime = ctx.currentTime + 0.05;
    },
    pump() {
      const ctx = state.ctx;
      if (!ctx || !state.music || state.muted || state.volume <= 0) return;
      if (!state.nextTime || state.nextTime < ctx.currentTime) state.nextTime = ctx.currentTime + 0.04;
      while (state.nextTime < ctx.currentTime + 0.28) {
        const step = state.stepIndex;
        const t = state.nextTime;
        tone(state.musicBus, {
          type: "square",
          freq: midi(LEAD[step]),
          t,
          dur: STEP * 0.85,
          gain: 0.18,
        });
        if (step % 2 === 0) {
          tone(state.musicBus, {
            type: "triangle",
            freq: midi(BASS[(step / 2) % BASS.length]),
            t,
            dur: STEP * 1.7,
            gain: 0.28,
          });
        }
        state.stepIndex = (step + 1) % LEAD.length;
        state.nextTime += STEP;
      }
    },
    ui() {
      const t = now();
      if (!state.ctx) return;
      tone(state.sfx, { type: "square", freq: 660, t, dur: 0.06, gain: 0.12 });
    },
    countdown(n) {
      const t = now();
      if (!state.ctx) return;
      tone(state.sfx, { type: "square", freq: n <= 1 ? 880 : 520 + n * 40, t, dur: 0.12, gain: 0.16 });
    },
    go() {
      const t = now();
      if (!state.ctx) return;
      tone(state.sfx, { type: "square", freq: 880, freq2: 1320, t, dur: 0.18, gain: 0.18 });
    },
    hit() {
      const t = now();
      if (!state.ctx) return;
      tone(state.sfx, { type: "square", freq: 160, freq2: 70, t, dur: 0.1, gain: 0.2 });
      burst(t, 0.08, 0.25);
    },
    boost() {
      const t = now();
      if (!state.ctx) return;
      tone(state.sfx, { type: "sawtooth", freq: 220, freq2: 740, t, dur: 0.16, gain: 0.12 });
    },
    pulse() {
      const t = now();
      if (!state.ctx) return;
      tone(state.sfx, { type: "sine", freq: 90, freq2: 40, t, dur: 0.18, gain: 0.28 });
    },
    pickup() {
      const t = now();
      if (!state.ctx) return;
      [660, 880, 1180].forEach((freq, i) => {
        tone(state.sfx, { type: "square", freq, t: t + i * 0.06, dur: 0.08, gain: 0.12 });
      });
    },
    ko() {
      const t = now();
      if (!state.ctx) return;
      tone(state.sfx, { type: "sawtooth", freq: 240, freq2: 50, t, dur: 0.38, gain: 0.16 });
      burst(t, 0.22, 0.2);
    },
    win(match) {
      const t = now();
      if (!state.ctx) return;
      const notes = match ? [523, 659, 784, 1046, 784, 1046] : [523, 659, 784, 1046];
      notes.forEach((freq, i) => {
        tone(state.sfx, { type: "square", freq, t: t + i * 0.09, dur: 0.12, gain: 0.14 });
      });
    },
  };
}

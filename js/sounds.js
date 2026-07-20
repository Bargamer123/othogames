// ============================================================
// Sound effects, synthesized with WebAudio — no files, no
// copyright, loads instantly. Browsers only allow audio after
// the user has clicked something, so early sounds may be silent
// until the first interaction.
// ============================================================

let ctx = null;
let muted = false;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function setMuted(m) { muted = m; }
export function isMuted() { return muted; }
export function unlockAudio() { try { ac(); } catch (e) { /* no audio support */ } }

// one note: freq in Hz, start offset + duration in seconds
function tone(freq, at, dur, { type = "triangle", gain = 0.12, slideTo = null } = {}) {
  if (muted) return;
  try {
    const c = ac();
    const t0 = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  } catch (e) { /* audio blocked or unsupported — stay quiet */ }
}

export const sfx = {
  // someone joined the lobby
  join() { tone(523, 0, 0.09); tone(784, 0.09, 0.14); },

  // round starts / question appears
  start() { tone(392, 0, 0.1); tone(523, 0.1, 0.1); tone(659, 0.2, 0.18, { gain: 0.14 }); },

  // a player locks in an answer (played on their own device)
  lock() { tone(880, 0, 0.06, { type: "square", gain: 0.06 }); tone(1175, 0.06, 0.08, { type: "square", gain: 0.06 }); },

  // guessing opens — a little "here we go" tick
  tick() { tone(660, 0, 0.06, { gain: 0.08 }); },

  // drumroll-ish rise into the reveal
  reveal() {
    for (let i = 0; i < 6; i++) tone(220 + i * 60, i * 0.07, 0.06, { type: "square", gain: 0.05 });
    tone(659, 0.45, 0.12); tone(880, 0.57, 0.22, { gain: 0.15 });
  },

  // points ding
  ding() { tone(1047, 0, 0.12, { gain: 0.1 }); tone(1319, 0.1, 0.18, { gain: 0.1 }); },

  // end-of-game fanfare
  fanfare() {
    const notes = [523, 523, 523, 659, 784, 659, 784];
    const durs =  [0.12, 0.12, 0.12, 0.18, 0.3, 0.18, 0.5];
    let t = 0;
    notes.forEach((n, i) => { tone(n, t, durs[i], { gain: 0.14 }); tone(n / 2, t, durs[i], { type: "sine", gain: 0.08 }); t += durs[i]; });
  },
};

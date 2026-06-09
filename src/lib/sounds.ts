/* ===================================================================
   ChessCash — Sound Engine
   All sounds are synthesized with the Web Audio API at runtime —
   zero audio assets. Tuned for a warm "wood and brass" club feel.
   =================================================================== */

'use client';

export type SoundType =
  | 'move'
  | 'capture'
  | 'castle'
  | 'check'
  | 'promote'
  | 'illegal'
  | 'gameStart'
  | 'victory'
  | 'defeat'
  | 'draw'
  | 'lowTime'
  | 'puzzleCorrect'
  | 'puzzleWrong';

let ctx: AudioContext | null = null;
let masterVolume = 0.7;
let enabled = true;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function configureSound(opts: { enabled: boolean; volume: number }) {
  enabled = opts.enabled;
  masterVolume = opts.volume;
}

/** Short percussive thump — the body of a wooden piece landing. */
function thump(ac: AudioContext, t: number, freq: number, gain: number, dur = 0.09) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.45), t + dur);
  g.gain.setValueAtTime(gain * masterVolume, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Filtered noise burst — the "click" texture of wood on wood. */
function click(ac: AudioContext, t: number, cutoff: number, gain: number, dur = 0.04) {
  const len = Math.ceil(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = cutoff;
  filter.Q.value = 0.9;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain * masterVolume, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(t);
}

/** Pure tone with envelope — for chimes and alerts. */
function tone(
  ac: AudioContext,
  t: number,
  freq: number,
  gain: number,
  dur: number,
  type: OscillatorType = 'sine'
) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain * masterVolume, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function playSound(type: SoundType) {
  if (!enabled || masterVolume <= 0) return;
  const ac = getCtx();
  if (!ac) return;
  const t = ac.currentTime + 0.005;

  switch (type) {
    case 'move':
      click(ac, t, 2200, 0.5);
      thump(ac, t, 180, 0.5);
      break;
    case 'capture':
      click(ac, t, 1400, 0.7, 0.06);
      thump(ac, t, 120, 0.8, 0.13);
      thump(ac, t + 0.015, 90, 0.4, 0.1);
      break;
    case 'castle':
      click(ac, t, 2000, 0.45);
      thump(ac, t, 170, 0.5);
      click(ac, t + 0.09, 2000, 0.45);
      thump(ac, t + 0.09, 150, 0.5);
      break;
    case 'check':
      tone(ac, t, 880, 0.32, 0.12, 'triangle');
      tone(ac, t + 0.1, 1108.7, 0.32, 0.18, 'triangle');
      break;
    case 'promote':
      tone(ac, t, 587.3, 0.3, 0.12, 'triangle');
      tone(ac, t + 0.08, 740, 0.3, 0.12, 'triangle');
      tone(ac, t + 0.16, 880, 0.34, 0.22, 'triangle');
      break;
    case 'illegal':
      tone(ac, t, 140, 0.4, 0.12, 'square');
      break;
    case 'gameStart':
      tone(ac, t, 440, 0.28, 0.12, 'triangle');
      tone(ac, t + 0.1, 659.3, 0.3, 0.2, 'triangle');
      break;
    case 'victory':
      tone(ac, t, 523.3, 0.32, 0.14, 'triangle');
      tone(ac, t + 0.12, 659.3, 0.32, 0.14, 'triangle');
      tone(ac, t + 0.24, 784, 0.32, 0.14, 'triangle');
      tone(ac, t + 0.36, 1046.5, 0.38, 0.4, 'triangle');
      break;
    case 'defeat':
      tone(ac, t, 392, 0.3, 0.2, 'triangle');
      tone(ac, t + 0.18, 311.1, 0.3, 0.2, 'triangle');
      tone(ac, t + 0.36, 233.1, 0.32, 0.42, 'triangle');
      break;
    case 'draw':
      tone(ac, t, 440, 0.28, 0.18, 'triangle');
      tone(ac, t + 0.16, 440, 0.28, 0.3, 'triangle');
      break;
    case 'lowTime':
      tone(ac, t, 1318.5, 0.26, 0.07, 'square');
      tone(ac, t + 0.09, 1318.5, 0.26, 0.07, 'square');
      break;
    case 'puzzleCorrect':
      tone(ac, t, 659.3, 0.3, 0.1, 'triangle');
      tone(ac, t + 0.09, 987.8, 0.32, 0.18, 'triangle');
      break;
    case 'puzzleWrong':
      tone(ac, t, 220, 0.32, 0.14, 'square');
      tone(ac, t + 0.12, 174.6, 0.3, 0.2, 'square');
      break;
  }
}

/** Pick the right move sound from a SAN string + state flags. */
export function playMoveSound(san: string, opts?: { isCheckmate?: boolean; isCheck?: boolean }) {
  if (opts?.isCheckmate) return; // game-end sound handles it
  if (opts?.isCheck) return playSound('check');
  if (san.includes('=')) return playSound('promote');
  if (san.startsWith('O-O')) return playSound('castle');
  if (san.includes('x')) return playSound('capture');
  playSound('move');
}

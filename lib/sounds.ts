/**
 * Notification sounds, synthesized with the Web Audio API so no audio file has
 * to ship. Each kind of alert has its own pattern, so people can tell what
 * happened without looking:
 *
 *   new_order     bright rising three-note chime
 *   order_update  soft two-note "ding-dong" (customer order progress)
 *   delivery      double rising chime (driver: new delivery assigned)
 *   low_stock     two falling warning tones, played twice
 *   out_of_stock  three short low beeps (most urgent)
 *
 * Browsers only allow sound after the person has interacted with the page, so
 * `unlockAudio()` is called on the first click or key press. Until then alerts
 * still show visually; they just stay silent.
 *
 * The on/off preference is per browser (localStorage), toggled in Settings.
 */

export type AlertSound = "new_order" | "order_update" | "delivery" | "low_stock" | "out_of_stock";

type Note = { freq: number; at: number; dur: number; wave?: OscillatorType; gain?: number };

const PATTERNS: Record<AlertSound, Note[]> = {
  new_order: [
    { freq: 1047, at: 0, dur: 0.16 },
    { freq: 1319, at: 0.13, dur: 0.16 },
    { freq: 1568, at: 0.26, dur: 0.32 },
  ],
  order_update: [
    { freq: 1175, at: 0, dur: 0.22 },
    { freq: 880, at: 0.2, dur: 0.38 },
  ],
  delivery: [
    { freq: 880, at: 0, dur: 0.16 },
    { freq: 1175, at: 0.18, dur: 0.2 },
    { freq: 880, at: 0.5, dur: 0.16 },
    { freq: 1175, at: 0.68, dur: 0.28 },
  ],
  low_stock: [
    { freq: 784, at: 0, dur: 0.2, wave: "triangle", gain: 0.3 },
    { freq: 587, at: 0.22, dur: 0.26, wave: "triangle", gain: 0.3 },
    { freq: 784, at: 0.6, dur: 0.2, wave: "triangle", gain: 0.3 },
    { freq: 587, at: 0.82, dur: 0.3, wave: "triangle", gain: 0.3 },
  ],
  out_of_stock: [
    { freq: 440, at: 0, dur: 0.14, wave: "square", gain: 0.09 },
    { freq: 440, at: 0.2, dur: 0.14, wave: "square", gain: 0.09 },
    { freq: 440, at: 0.4, dur: 0.24, wave: "square", gain: 0.09 },
  ],
};

/** Which sound wins when several alerts arrive at once. */
const PRIORITY: AlertSound[] = ["out_of_stock", "new_order", "delivery", "low_stock", "order_update"];

export function loudestOf(kinds: AlertSound[]): AlertSound | null {
  return PRIORITY.find((k) => kinds.includes(k)) ?? null;
}

// ── On/off preference ────────────────────────────────────────────────────────
const STORAGE_KEY = "notification-sound";
const CHANGE_EVENT = "notification-sound-change";

export function isSoundOn(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch { /* storage blocked: the choice lasts until reload */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** For useSyncExternalStore: re-render when the preference changes in this or another tab. */
export function subscribeSound(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// ── Playback ────────────────────────────────────────────────────────────────
// One shared context: browsers cap how many can exist, and a fresh one per
// alert would also start suspended again.
let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

/**
 * True when the browser is still holding sound back because nobody has clicked
 * or typed on the page since it loaded. Alerts are silent until then.
 */
export function audioBlocked(): boolean {
  const c = getContext();
  return !c || c.state !== "running";
}

/** Call from a click or key press so later alerts are allowed to make sound. */
export function unlockAudio() {
  const c = getContext();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

/**
 * Plays an alert. Respects the on/off preference unless `force` is set (the
 * "Test sound" button). Never throws: a blocked or missing audio device just
 * means the alert is silent.
 */
export function playAlert(kind: AlertSound, { force = false }: { force?: boolean } = {}) {
  if (!force && !isSoundOn()) return;
  const c = getContext();
  if (!c) return;
  try {
    if (c.state === "suspended") c.resume().catch(() => {});
    const t0 = c.currentTime + 0.02;
    for (const n of PATTERNS[kind]) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = n.wave ?? "sine";
      osc.frequency.value = n.freq;
      const start = t0 + n.at;
      const peak = n.gain ?? 0.28;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);
      osc.connect(gain).connect(c.destination);
      osc.start(start);
      osc.stop(start + n.dur + 0.02);
    }
  } catch { /* audio unavailable: the visual alert still shows */ }
}

import { DEFAULT_BPM, LOG_PREFIX, TARGET_DURATION } from './config.js';

export function createMinimalScene() {
  return {
    meta: { title: 'Emergency Scene', duration: TARGET_DURATION, bpm: DEFAULT_BPM, seed: 42 },
    beats: [],
    shots: [
      {
        name: 'Emergency Flight',
        time: [0, TARGET_DURATION],
        path: {
          type: 'catmullrom',
          points: [
            [-28, 48, 120],
            [-6, 38, 80],
            [6, 22, 40],
            [8, 9, 8],
            [4, 6, -28]
          ]
        },
        camera: {
          fov: [58, 74],
          rollDeg: [-2, 3],
          oscillation: 0.4,
          tempoFov: 10,
          tempoRoll: 0.15,
          tempoShake: 0.6,
          tempoPush: 1.6,
          ease: 'easeInOut'
        },
        fx: {
          bloom: [0.22, 0.32],
          vignette: [0.3, 0.46],
          neonPulse: 0.4,
          sparkle: 0.4,
          flash: 0.16,
          exposure: 0.95,
          haze: 0.013,
          hazePulse: 0.01,
          fade: [TARGET_DURATION - 0.6, TARGET_DURATION]
        }
      }
    ]
  };
}

export function regenerateBeats(data) {
  if (!data || !data.meta) return;
  const bpm = data.meta.bpm || DEFAULT_BPM;
  const beatDuration = 60 / bpm;
  const beats = [];
  for (let t = 0; t <= data.meta.duration + 0.0001; t += beatDuration) {
    beats.push(parseFloat(t.toFixed(4)));
  }
  data.beats = beats;
}

export function normalizeSceneData(data) {
  const normalized = data ? JSON.parse(JSON.stringify(data)) : createMinimalScene();

  if (!normalized.meta) normalized.meta = {};
  normalized.meta.duration = TARGET_DURATION;
  normalized.meta.bpm = normalized.meta.bpm || DEFAULT_BPM;
  normalized.meta.seed = normalized.meta.seed || 42;

  if (!Array.isArray(normalized.shots)) {
    normalized.shots = createMinimalScene().shots;
  }

  normalized.shots = normalized.shots.filter((shot) => Array.isArray(shot.time) && shot.time.length === 2);
  normalized.shots.sort((a, b) => (a.time[0] || 0) - (b.time[0] || 0));

  normalized.shots.forEach((shot) => {
    if (Array.isArray(shot.time)) {
      shot.time[0] = Math.max(0, Math.min(TARGET_DURATION, shot.time[0] || 0));
      shot.time[1] = Math.max(shot.time[0] + 0.01, Math.min(TARGET_DURATION, shot.time[1] || TARGET_DURATION));
    }
    shot.camera = shot.camera || {};
    shot.camera.fov = shot.camera.fov || [60, 68];
    shot.camera.rollDeg = shot.camera.rollDeg || [0, 0];
    shot.camera.oscillation = shot.camera.oscillation || 0;
    shot.fx = shot.fx || {};
    shot.fx.bloom = shot.fx.bloom || [0.18, 0.28];
    shot.fx.vignette = shot.fx.vignette || [0.28, 0.4];
  });

  if (!Array.isArray(normalized.beats) || normalized.beats.length === 0) {
    regenerateBeats(normalized);
  } else {
    const beatDuration = 60 / normalized.meta.bpm;
    normalized.beats = normalized.beats
      .map((value) => typeof value === 'number' ? value : parseFloat(value))
      .filter((value) => Number.isFinite(value))
      .filter((value) => value >= 0 && value <= normalized.meta.duration)
      .sort((a, b) => a - b);
    const lastBeat = normalized.beats[normalized.beats.length - 1] || 0;
    for (let t = lastBeat + beatDuration; t <= normalized.meta.duration + 0.0001; t += beatDuration) {
      normalized.beats.push(parseFloat(t.toFixed(4)));
    }
  }

  return normalized;
}

export async function loadSceneDataAsync() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch('scene.json', { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    return normalizeSceneData(json);
  } catch (err) {
    console.warn(LOG_PREFIX, 'Failed to fetch scene.json:', err.message);
    return normalizeSceneData(loadInlineScene());
  }
}

export function loadInlineScene() {
  try {
    const scriptEl = document.getElementById('scene-inline');
    if (!scriptEl) {
      throw new Error('Inline scene not found');
    }
    return JSON.parse(scriptEl.textContent);
  } catch (err) {
    console.error(LOG_PREFIX, 'Inline scene parse failed:', err);
    return createMinimalScene();
  }
}

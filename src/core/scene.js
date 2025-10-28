import { BASE_FOG_DENSITY } from './config.js';
import { rebuildEnvironmentForScene } from './environment.js';
import { normalizeSceneData, regenerateBeats } from './sceneData.js';
import { runtime, resetTempoState } from './state.js';
import { showStatus } from './status.js';

export function applySceneData(data, statusMessage) {
  runtime.sceneData = normalizeSceneData(data);
  runtime.currentSeed = runtime.sceneData.meta.seed || 42;
  resetTempoState(runtime.sceneData.meta.bpm);

  runtime.cityFogDensity = BASE_FOG_DENSITY;
  if (runtime.scene && runtime.scene.fog) {
    runtime.scene.fog.density = runtime.cityFogDensity;
  }

  rebuildEnvironmentForScene();
  runtime.currentShot = null;
  runtime.cameraCurve = null;
  updateTimeline();
  refreshPresetUI(runtime.sceneData);
  if (statusMessage) {
    showStatus(statusMessage, 2000);
  }
}

export function updateTimeline() {
  if (!runtime.playbackProgressEl) return;
  const duration = (runtime.sceneData && runtime.sceneData.meta && runtime.sceneData.meta.duration) || 30;
  const progress = duration > 0 ? Math.min(Math.max(runtime.currentTime / duration, 0), 1) : 0;
  runtime.playbackProgressEl.style.width = `${(progress * 100).toFixed(2)}%`;
}

export function refreshPresetUI(data) {
  const title = data && data.meta && data.meta.title ? data.meta.title : 'Default';

  if (runtime.presetLabelEl) {
    runtime.presetLabelEl.textContent = title;
  }

  if (runtime.modePillEl) {
    const base = title.toUpperCase();
    const label = base.includes('MODE') ? base : `${base} MODE`;
    runtime.modePillEl.textContent = label.length > 26 ? `${label.slice(0, 26)}…` : label;
  }

  if (runtime.bpmInputEl && data && data.meta && data.meta.bpm) {
    const bpm = Math.round(data.meta.bpm);
    runtime.bpmInputEl.value = bpm;
    const bpmValueEl = document.getElementById('bpm-value');
    if (bpmValueEl) {
      bpmValueEl.textContent = bpm;
    }
  }
}

export function ensureBeats() {
  if (!runtime.sceneData) return;
  regenerateBeats(runtime.sceneData);
}

import { LOG_PREFIX } from './core/config.js';
import { setupRenderer, setupScene, setupCamera, setupLights } from './core/environment.js';
import { loadSceneDataAsync, loadInlineScene, normalizeSceneData } from './core/sceneData.js';
import { applySceneData, ensureBeats, updateTimeline } from './core/scene.js';
import { setupPostProcessing } from './core/postprocessing.js';
import { startRenderLoop } from './core/renderLoop.js';
import { setupUI, setupKeyboard, onResize, syncPlayStateUI } from './core/ui.js';
import { isWebGLAvailable } from './core/system.js';
import { runtime, tempoState } from './core/state.js';
import { showStatus } from './core/status.js';

let overlayBound = false;
let initialSceneData = null;

async function init() {
  console.log(LOG_PREFIX, 'Starting init...');

  const canvas = document.getElementById('canvas');
  const initStatus = document.getElementById('init-status');

  try {
    if (!isWebGLAvailable()) {
      console.warn(LOG_PREFIX, 'WebGL not available, using 2D fallback');
      if (window.initFallback2D) {
        setTimeout(() => window.initFallback2D(), 100);
      }
      return;
    }

    setupRenderer(canvas);
    setupScene();
    setupCamera();
    setupLights();

    setupUI();
    setupKeyboard();
    wireOverlayControls();

    if (initStatus) {
      initStatus.textContent = 'Loading scene...';
    }

    let data;
    try {
      data = await loadSceneDataAsync();
      console.log(LOG_PREFIX, '✓ Loaded scene.json');
    } catch (err) {
      console.warn(LOG_PREFIX, 'Scene load failed, using fallback:', err);
      data = normalizeSceneData(loadInlineScene());
    }

    applySceneData(data);
    initialSceneData = JSON.parse(JSON.stringify(runtime.sceneData));
    syncBpmSliderFromState();
    console.log(LOG_PREFIX, '✓ Scene applied');

    setupPostProcessing();
    console.log(LOG_PREFIX, '✓ Post-processing setup complete');

    runtime.isInitialized = true;
    startRenderLoop();
    console.log(LOG_PREFIX, '✓ Render loop started');

    syncPlayStateUI();
    revealUI();
  } catch (error) {
    console.error(LOG_PREFIX, 'Critical init error:', error);
    if (initStatus) {
      initStatus.textContent = 'Error: ' + error.message;
      initStatus.className = 'error';
    }
    try {
      setupUI();
      setupKeyboard();
      wireOverlayControls();
      revealUI(true);
    } catch (uiErr) {
      console.error(LOG_PREFIX, 'UI setup failed:', uiErr);
    }
  }
}

function revealUI(isRecovery = false) {
  setTimeout(() => {
    const spinner = document.getElementById('init-spinner');
    const status = document.getElementById('init-status');
    const buttons = document.getElementById('splash-buttons');
    const controls = document.getElementById('splash-controls');
    const instructions = document.getElementById('instructions-box');

    if (spinner) {
      spinner.classList.add('hidden');
    }
    if (status) {
      status.textContent = isRecovery ? '✓ Ready (safe mode)' : '✓ Ready';
      status.className = 'success';
    }
    if (buttons) {
      buttons.style.display = 'flex';
    }
    if (controls) {
      controls.style.display = 'flex';
    }
    if (instructions) {
      instructions.style.display = 'block';
    }

    if (runtime.controlDeckEl) {
      runtime.controlDeckEl.classList.add('visible');
    }
  }, 500);
}

function wireOverlayControls() {
  if (overlayBound) return;
  overlayBound = true;

  const bpmSlider = document.getElementById('bpm-input');
  const bpmValueEl = document.getElementById('bpm-value');
  const presetBtn = document.getElementById('preset-30s');

  if (bpmSlider) {
    runtime.bpmInputEl = bpmSlider;

    bpmSlider.addEventListener('input', (event) => {
      const value = parseFloat(event.target.value);
      if (!runtime.sceneData || !Number.isFinite(value) || value < 40) {
        return;
      }

      runtime.sceneData.meta.bpm = value;
      tempoState.bpm = value;
      tempoState.beatDuration = 60 / value;
      tempoState.barDuration = tempoState.beatDuration * 4;
      tempoState.beatIndex = 0;
      tempoState.lastBeatTime = 0;
      tempoState.nextBeatTime = tempoState.beatDuration;
      tempoState.audioPulse = 0;
      tempoState.energy = 0;
      ensureBeats();

      if (bpmValueEl) {
        bpmValueEl.textContent = Math.round(value);
      }

      showStatus(`BPM calé sur ${Math.round(value)}`, 2000);
    });
  }

  if (presetBtn) {
    presetBtn.addEventListener('click', async () => {
      await resetMoonrunPreset();
    });
  }

  syncBpmSliderFromState();
}

async function resetMoonrunPreset() {
  if (!runtime.isInitialized) {
    console.warn(LOG_PREFIX, 'Preset 30s ignored: runtime not ready');
    return;
  }

  try {
    const sourceData = initialSceneData
      ? JSON.parse(JSON.stringify(initialSceneData))
      : await loadSceneDataAsync();

    runtime.isPlaying = false;
    runtime.currentTime = 0;
    runtime.lastFrameTime = 0;

    if (runtime.audioElement) {
      runtime.audioElement.pause();
      runtime.audioElement.currentTime = 0;
      runtime.audioElement.playbackRate = runtime.playbackSpeed;
    }

    applySceneData(sourceData, '✓ Preset Moonrun 30s rechargé');
    updateTimeline();
    syncPlayStateUI();
    syncBpmSliderFromState();
  } catch (err) {
    console.error(LOG_PREFIX, 'Failed to reload Moonrun preset:', err);
    showStatus('⚠ Impossible de recharger le preset Moonrun', 3000);
  }
}

function syncBpmSliderFromState() {
  const bpmSlider = document.getElementById('bpm-input');
  const bpmValueEl = document.getElementById('bpm-value');
  if (!bpmSlider) return;

  const bpm = runtime.sceneData && runtime.sceneData.meta && runtime.sceneData.meta.bpm
    ? runtime.sceneData.meta.bpm
    : tempoState.bpm;

  const rounded = Math.round(bpm);
  bpmSlider.value = rounded;
  if (bpmValueEl) {
    bpmValueEl.textContent = rounded;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log(LOG_PREFIX, 'DOM ready');
    setTimeout(init, 100);
  });
} else {
  console.log(LOG_PREFIX, 'DOM already ready');
  setTimeout(init, 100);
}

window.addEventListener('error', (e) => {
  console.error(LOG_PREFIX, 'Global error:', e.error);
});

window.addEventListener('resize', onResize);

console.log(LOG_PREFIX, 'Script loaded');

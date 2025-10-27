import { LOG_PREFIX } from './core/config.js';
import { setupRenderer, setupScene, setupCamera, setupLights } from './core/environment.js';
import { loadSceneDataAsync, loadInlineScene, normalizeSceneData } from './core/sceneData.js';
import { applySceneData } from './core/scene.js';
import { setupPostProcessing } from './core/postprocessing.js';
import { startRenderLoop } from './core/renderLoop.js';
import { setupUI, setupKeyboard, onResize, syncPlayStateUI } from './core/ui.js';
import { isWebGLAvailable } from './core/system.js';
import { runtime } from './core/state.js';

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

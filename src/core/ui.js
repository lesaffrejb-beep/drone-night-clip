import { LOG_PREFIX } from './config.js';
import { setupAudio, isAudioFile } from './audio.js';
import { startRecording } from './recording.js';
import { loadSceneDataAsync, normalizeSceneData } from './sceneData.js';
import { applySceneData, ensureBeats, updateTimeline } from './scene.js';
import { runtime, tempoState } from './state.js';
import { showStatus } from './status.js';

export function setupUI() {
  console.log(LOG_PREFIX, 'Setting up UI...');

  runtime.controlDeckEl = document.getElementById('control-deck');
  runtime.playPauseBtn = document.getElementById('btn-playpause');
  runtime.playbackProgressEl = document.getElementById('playback-progress');
  runtime.modePillEl = document.getElementById('mode-pill');
  runtime.audioFilenameEl = document.getElementById('audio-filename');
  runtime.presetLabelEl = document.getElementById('preset-label');
  const audioInputMain = document.getElementById('input-audio-main');
  const audioChip = document.getElementById('audio-chip');
  const dropOverlay = document.getElementById('drop-overlay');

  if (runtime.audioFilenameEl) {
    runtime.audioFilenameEl.textContent = 'No track';
  }
  if (runtime.presetLabelEl) {
    runtime.presetLabelEl.textContent = 'Default';
  }

  const handleAudioFile = (file) => {
    if (!file) return;
    if (dropOverlay) {
      dropOverlay.classList.remove('visible');
      dropOverlay.setAttribute('aria-hidden', 'true');
    }
    setupAudio(file);
  };

  const btnStart = document.getElementById('btn-start');
  if (btnStart) {
    btnStart.addEventListener('click', () => {
      console.log(LOG_PREFIX, 'Start button clicked');

      if (runtime.audioContext && runtime.audioContext.state === 'suspended') {
        runtime.audioContext.resume().catch((err) => {
          console.warn(LOG_PREFIX, 'AudioContext resume failed:', err);
        });
      }

      document.getElementById('splash').classList.add('hidden');

      runtime.isPlaying = true;
      startRecording();
      syncPlayStateUI();
      console.log(LOG_PREFIX, 'Playback and recording started');
    });
  }

  if (runtime.playPauseBtn) {
    runtime.playPauseBtn.addEventListener('click', () => {
      if (!runtime.isInitialized) return;

      runtime.isPlaying = !runtime.isPlaying;
      if (runtime.isPlaying) {
        if (runtime.audioElement) {
          runtime.audioElement.playbackRate = runtime.playbackSpeed;
          runtime.audioElement.play().catch((err) => {
            console.warn(LOG_PREFIX, 'Audio play error:', err);
          });
        }
      } else if (runtime.audioElement) {
        runtime.audioElement.pause();
      }

      syncPlayStateUI();
      console.log(LOG_PREFIX, runtime.isPlaying ? 'Playing' : 'Paused');
    });
  }

  const btnReset = document.getElementById('btn-reset');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      runtime.currentTime = 0;
      if (runtime.audioElement) {
        runtime.audioElement.currentTime = 0;
        runtime.audioElement.playbackRate = runtime.playbackSpeed;
      }
      console.log(LOG_PREFIX, 'Restarted');
      updateTimeline();
    });
  }

  const audioInputSplash = document.getElementById('input-audio-splash');
  if (audioInputSplash) {
    audioInputSplash.addEventListener('change', (event) => {
      const [file] = event.target.files;
      if (file) handleAudioFile(file);
    });
  }

  if (audioInputMain) {
    audioInputMain.addEventListener('change', (event) => {
      const [file] = event.target.files;
      if (file) handleAudioFile(file);
    });
  }

  if (audioChip && audioInputMain) {
    audioChip.addEventListener('click', () => {
      audioInputMain.click();
    });
    audioChip.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        audioInputMain.click();
      }
    });
  }

  if (dropOverlay) {
    let dragDepth = 0;
    const showOverlay = () => {
      dropOverlay.classList.add('visible');
      dropOverlay.setAttribute('aria-hidden', 'false');
    };
    const hideOverlay = () => {
      dragDepth = 0;
      dropOverlay.classList.remove('visible');
      dropOverlay.setAttribute('aria-hidden', 'true');
    };

    dropOverlay.addEventListener('click', () => hideOverlay());

    window.addEventListener('dragenter', (event) => {
      const hasFiles = event.dataTransfer && Array.from(event.dataTransfer.types || []).includes('Files');
      if (!hasFiles) return;
      dragDepth += 1;
      showOverlay();
      event.preventDefault();
    });

    window.addEventListener('dragover', (event) => {
      const hasFiles = event.dataTransfer && Array.from(event.dataTransfer.types || []).includes('Files');
      if (!hasFiles) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      if (!dropOverlay.classList.contains('visible')) {
        showOverlay();
      }
    });

    window.addEventListener('dragleave', () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) {
        hideOverlay();
      }
    });

    window.addEventListener('drop', (event) => {
      const files = Array.from((event.dataTransfer && event.dataTransfer.files) || []);
      hideOverlay();
      event.preventDefault();
      const audioFile = files.find((file) => isAudioFile(file));
      if (audioFile) {
        handleAudioFile(audioFile);
      } else if (files.length) {
        showStatus('Dépose un fichier audio (MP3, WAV, AIFF...)', 2800);
      }
    });

    window.addEventListener('dragend', () => hideOverlay());
  }

  runtime.bpmInputEl = document.getElementById('input-bpm');
  if (runtime.bpmInputEl) {
    runtime.bpmInputEl.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
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
      showStatus(`BPM calé sur ${Math.round(value)}`, 2000);
    });
  }

  const presetSelect = document.getElementById('preset-select');
  if (presetSelect) {
    presetSelect.addEventListener('change', async (e) => {
      const preset = e.target.value;
      if (preset === 'insane') {
        console.log(LOG_PREFIX, 'Loading insane preset...');
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);

          const response = await fetch('presets/insane.json', { signal: controller.signal });
          clearTimeout(timeoutId);

          if (response.ok) {
            const presetData = normalizeSceneData(await response.json());
            applySceneData(presetData, '✓ Insane preset chargé');
            runtime.currentTime = 0;
            if (runtime.audioElement) runtime.audioElement.currentTime = 0;
            console.log(LOG_PREFIX, '✓ Insane preset loaded');
          } else {
            throw new Error(`HTTP ${response.status}`);
          }
        } catch (err) {
          console.warn(LOG_PREFIX, 'Failed to load insane preset, falling back to default:', err.message);
          showStatus('⚠ Preset indisponible, retour au mode principal', 3000);
          const fallback = await loadSceneDataAsync();
          applySceneData(fallback);
          runtime.currentTime = 0;
          if (runtime.audioElement) runtime.audioElement.currentTime = 0;
        }
      } else {
        const data = await loadSceneDataAsync();
        applySceneData(data, '✓ Mode principal chargé');
        runtime.currentTime = 0;
        if (runtime.audioElement) runtime.audioElement.currentTime = 0;
      }
    });
  }

  window.addEventListener('resize', onResize);

  console.log(LOG_PREFIX, '✓ UI setup complete');
}

export function setupKeyboard() {
  console.log(LOG_PREFIX, 'Setting up keyboard...');

  window.addEventListener('keydown', (e) => {
    switch (e.key) {
      case ' ':
        e.preventDefault();
        if (document.getElementById('splash').classList.contains('hidden')) {
          runtime.isPlaying = !runtime.isPlaying;
          if (runtime.isPlaying && runtime.audioElement) {
            runtime.audioElement.playbackRate = runtime.playbackSpeed;
            runtime.audioElement.play().catch((err) => {
              console.warn(LOG_PREFIX, 'Audio play error:', err);
            });
          } else if (!runtime.isPlaying && runtime.audioElement) {
            runtime.audioElement.pause();
          }
          syncPlayStateUI();
          console.log(LOG_PREFIX, runtime.isPlaying ? 'Playing' : 'Paused');
        }
        break;
      case 'h':
      case 'H': {
        runtime.hudVisible = !runtime.hudVisible;
        const hud = document.getElementById('hud');
        if (hud) {
          if (runtime.hudVisible) hud.classList.add('visible');
          else hud.classList.remove('visible');
        }
        console.log(LOG_PREFIX, 'HUD:', runtime.hudVisible ? 'visible' : 'hidden');
        break;
      }
      case ',':
        runtime.playbackSpeed = Math.max(0.5, runtime.playbackSpeed - 0.25);
        if (runtime.audioElement) {
          runtime.audioElement.playbackRate = runtime.playbackSpeed;
        }
        console.log(LOG_PREFIX, 'Speed:', runtime.playbackSpeed);
        break;
      case '.':
        runtime.playbackSpeed = Math.min(2.0, runtime.playbackSpeed + 0.25);
        if (runtime.audioElement) {
          runtime.audioElement.playbackRate = runtime.playbackSpeed;
        }
        console.log(LOG_PREFIX, 'Speed:', runtime.playbackSpeed);
        break;
      case 'r':
      case 'R':
        runtime.currentTime = 0;
        if (runtime.audioElement) {
          runtime.audioElement.currentTime = 0;
          runtime.audioElement.playbackRate = runtime.playbackSpeed;
        }
        console.log(LOG_PREFIX, 'Restarted');
        updateTimeline();
        break;
      case 's':
      case 'S':
        if (e.shiftKey) {
          takeScreenshot();
        }
        break;
      default:
        break;
    }
  });

  console.log(LOG_PREFIX, '✓ Keyboard setup complete');
}

export function onResize() {
  try {
    const wrapper = document.getElementById('canvas-wrapper');
    if (!wrapper) return;
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;
    const aspect = height > 0 ? width / height : runtime.camera.aspect;

    runtime.camera.aspect = aspect;
    runtime.camera.updateProjectionMatrix();

    if (runtime.renderer && runtime.renderer.domElement) {
      runtime.renderer.domElement.style.width = '100%';
      runtime.renderer.domElement.style.height = '100%';
    }
  } catch (err) {
    console.error(LOG_PREFIX, 'Resize error:', err);
  }
}

export function updateHUD() {
  try {
    document.getElementById('hud-time').textContent = runtime.currentTime.toFixed(2) + 's';
    document.getElementById('hud-shot').textContent = runtime.currentShot ? runtime.currentShot.name : '-';
    document.getElementById('hud-fps').textContent = runtime.fps;
    document.getElementById('hud-speed').textContent = runtime.playbackSpeed.toFixed(1) + 'x';
  } catch (err) {
    // ignore missing HUD nodes
  }
}

export function takeScreenshot() {
  try {
    const canvas = document.getElementById('canvas');
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `drone-night-screenshot-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      showStatus('Screenshot saved', 2000);
      console.log(LOG_PREFIX, '✓ Screenshot saved');
    });
  } catch (err) {
    console.error(LOG_PREFIX, 'Screenshot failed:', err);
  }
}

export function syncPlayStateUI() {
  if (runtime.playPauseBtn) {
    runtime.playPauseBtn.textContent = runtime.isPlaying ? 'Pause' : 'Play';
  }
}

import { DEFAULT_BPM, LOG_PREFIX } from './config.js';
import { runtime, tempoState } from './state.js';
import { showStatus } from './status.js';

const SUPPORTED_EXTS = ['.mp3', '.wav', '.aiff', '.aif', '.aac', '.ogg', '.flac', '.m4a', '.mp4'];

export function isAudioFile(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith('audio/')) {
    return true;
  }
  const name = (file.name || '').toLowerCase();
  return SUPPORTED_EXTS.some((ext) => name.endsWith(ext));
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.max(0, Math.round(seconds % 60)).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export function setupAudio(file) {
  console.log(LOG_PREFIX, 'Setting up audio...');
  try {
    if (!isAudioFile(file)) {
      showStatus('Dépose un fichier audio (MP3, WAV, AIFF...)', 2800);
      return;
    }

    if (!runtime.audioContext) {
      runtime.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } else if (runtime.audioContext.state === 'suspended') {
      runtime.audioContext.resume().catch((err) => {
        console.warn(LOG_PREFIX, 'AudioContext resume failed:', err);
      });
    }

    if (runtime.audioSource) {
      try {
        runtime.audioSource.disconnect();
      } catch (disconnectErr) {
        console.warn(LOG_PREFIX, 'Audio source disconnect failed:', disconnectErr);
      }
      runtime.audioSource = null;
    }

    if (runtime.audioElement) {
      runtime.audioElement.pause();
      runtime.audioElement.src = '';
      runtime.audioElement.load();
    }

    if (runtime.audioObjectURL) {
      URL.revokeObjectURL(runtime.audioObjectURL);
      runtime.audioObjectURL = null;
    }

    runtime.audioElement = document.createElement('audio');
    runtime.audioElement.crossOrigin = 'anonymous';
    runtime.audioObjectURL = URL.createObjectURL(file);
    runtime.audioElement.src = runtime.audioObjectURL;
    runtime.audioElement.loop = true;
    runtime.audioElement.playbackRate = runtime.playbackSpeed;
    runtime.audioElement.load();

    runtime.analyser = runtime.audioContext.createAnalyser();
    runtime.analyser.fftSize = 512;
    runtime.analyser.smoothingTimeConstant = 0.7;
    runtime.audioData = new Uint8Array(runtime.analyser.frequencyBinCount);

    runtime.audioSource = runtime.audioContext.createMediaElementSource(runtime.audioElement);
    runtime.audioSource.connect(runtime.analyser);
    runtime.analyser.connect(runtime.audioContext.destination);

    runtime.audioElement.addEventListener('loadedmetadata', () => {
      const formatted = formatDuration(runtime.audioElement.duration);
      if (formatted) {
        showStatus(`Audio chargé · ${formatted}`, 2600);
      } else {
        showStatus('Audio chargé', 2200);
      }
      console.log(LOG_PREFIX, 'Audio duration:', runtime.audioElement.duration);
    }, { once: true });

    runtime.audioElement.addEventListener('error', (event) => {
      console.warn(LOG_PREFIX, 'Audio element error:', event);
      showStatus('Lecture audio impossible', 3000);
    });

    runtime.hasAudio = true;
    console.log(LOG_PREFIX, '✓ Audio ready');

    if (runtime.audioFilenameEl) {
      runtime.audioFilenameEl.textContent = file.name || 'Custom track';
    }

    runtime.audioElement.currentTime = Math.max(0, Math.min(runtime.currentTime, runtime.audioElement.duration || runtime.currentTime));

    if (runtime.isPlaying) {
      runtime.audioElement.play().catch((err) => {
        console.warn(LOG_PREFIX, 'Audio play failed:', err);
      });
    }
  } catch (err) {
    console.error(LOG_PREFIX, 'Audio setup failed:', err);
    showStatus('Audio failed: ' + err.message, 3000);
  }
}

export function sampleAudioEnergy() {
  if (runtime.hasAudio && runtime.analyser && runtime.audioData) {
    try {
      runtime.analyser.getByteFrequencyData(runtime.audioData);
      const bassBins = Math.max(4, Math.floor(runtime.audioData.length * 0.22));
      let bassSum = 0;
      for (let i = 0; i < bassBins; i++) {
        bassSum += runtime.audioData[i];
      }
      const normalized = bassBins > 0 ? bassSum / (bassBins * 255) : 0;
      runtime.lastAudioEnergy = Math.min(1, normalized * 1.4);
    } catch (err) {
      console.warn(LOG_PREFIX, 'Audio analysis failed:', err);
    }
  } else {
    const beatDuration = tempoState.beatDuration > 0 ? tempoState.beatDuration : 60 / DEFAULT_BPM;
    const beatPhase = ((runtime.currentTime / beatDuration) % 1);
    const beatPulse = Math.pow(Math.sin(beatPhase * Math.PI), 2);
    const barDuration = tempoState.barDuration > 0 ? tempoState.barDuration : beatDuration * 4;
    const barPhase = ((runtime.currentTime / barDuration) % 1);
    runtime.lastAudioEnergy = 0.18 + beatPulse * 0.6 + Math.pow(Math.sin(barPhase * Math.PI), 2) * 0.25;
  }

  return runtime.lastAudioEnergy;
}

import { LOG_PREFIX, RECORDING_FPS } from './config.js';
import { hideStatus, showStatus } from './status.js';
import { runtime, tempoState } from './state.js';

export function startRecording() {
  if (runtime.isRecording) return;
  console.log(LOG_PREFIX, 'Starting recording (25fps)...');

  try {
    const canvas = document.getElementById('canvas');
    const stream = canvas.captureStream(RECORDING_FPS);

    runtime.recordedChunks = [];

    const options = {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 10000000
    };

    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'video/webm;codecs=vp8';
    }

    runtime.mediaRecorder = new MediaRecorder(stream, options);

    runtime.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        runtime.recordedChunks.push(e.data);
      }
    };

    runtime.mediaRecorder.onstop = () => {
      const blob = new Blob(runtime.recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      const now = new Date();
      const timestamp = now.toISOString().replace(/:/g, '').replace(/\..+/, '').replace('T', '-');
      a.download = `drone-night-clip-${timestamp}.webm`;
      a.click();

      URL.revokeObjectURL(url);
      showStatus('✓ Recording saved', 3000);
      console.log(LOG_PREFIX, `✓ Recording saved: drone-night-clip-${timestamp}.webm`);
    };

    runtime.mediaRecorder.start(100);
    runtime.isRecording = true;

    runtime.currentTime = 0;
    runtime.isPlaying = true;
    if (runtime.audioElement) {
      runtime.audioElement.currentTime = 0;
      runtime.audioElement.playbackRate = runtime.playbackSpeed;
      runtime.audioElement.play().catch((e) => console.warn(LOG_PREFIX, 'Audio play error:', e));
    }

    tempoState.beatIndex = 0;
    tempoState.lastBeatTime = 0;
    tempoState.nextBeatTime = tempoState.beatDuration;
    tempoState.audioPulse = 0;
    tempoState.energy = 0;

    showStatus('Enregistrement 1080×1920 @25fps', 0);

    console.log(LOG_PREFIX, '✓ Recording started');
  } catch (err) {
    console.error(LOG_PREFIX, 'Recording failed:', err);
    showStatus('Recording failed: ' + err.message, 5000);
  }
}

export function stopRecording() {
  if (!runtime.isRecording) return;
  console.log(LOG_PREFIX, 'Stopping recording...');

  try {
    runtime.mediaRecorder.stop();
    runtime.isRecording = false;
    hideStatus();
  } catch (err) {
    console.error(LOG_PREFIX, 'Stop recording error:', err);
  }
}

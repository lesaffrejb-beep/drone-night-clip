import { LOG_PREFIX, RECORDING_FPS, TARGET_DURATION } from './config.js';
import { sampleAudioEnergy } from './audio.js';
import { stopRecording } from './recording.js';
import { updateCameraPath, updateCityLights, updateCinematicElements, updateExposureAndPost } from './camera.js';
import { updateTempoState } from './tempo.js';
import { runtime } from './state.js';
import { updateTimeline } from './scene.js';
import { updateHUD, syncPlayStateUI } from './ui.js';

export function startRenderLoop() {
  runtime.lastFrameTime = performance.now();

  function render(timestamp) {
    requestAnimationFrame(render);

    try {
      const delta = timestamp - runtime.lastFrameTime;
      runtime.lastFrameTime = timestamp;

      runtime.fps = Math.round(1000 / Math.max(delta, 1));

      if (runtime.isPlaying) {
        if (runtime.isRecording) {
          runtime.currentTime += (1 / RECORDING_FPS) * runtime.playbackSpeed;
        } else {
          runtime.currentTime += (delta / 1000) * runtime.playbackSpeed;
        }

        const duration = (runtime.sceneData && runtime.sceneData.meta) ? runtime.sceneData.meta.duration : TARGET_DURATION;
        if (runtime.currentTime >= duration) {
          if (runtime.isRecording) {
            stopRecording();
            runtime.isPlaying = false;
            syncPlayStateUI();
          } else {
            runtime.currentTime = 0;
          }
        }

        if (runtime.audioElement && runtime.hasAudio) {
          try {
            const audioDiff = Math.abs(runtime.audioElement.currentTime - runtime.currentTime);
            if (audioDiff > 0.1) {
              runtime.audioElement.currentTime = runtime.currentTime;
            }
          } catch (err) {
            console.warn(LOG_PREFIX, 'Audio sync error:', err);
          }
        }
      }

      sampleAudioEnergy();
      updateTempoState();
      updateCameraPath();
      updateCityLights();
      updateCinematicElements(delta / 1000);
      updateExposureAndPost();

      if (runtime.composer) {
        runtime.composer.render();
      } else if (runtime.renderer) {
        runtime.renderer.render(runtime.scene, runtime.camera);
      }

      updateHUD();
      updateTimeline();
    } catch (err) {
      console.error(LOG_PREFIX, 'Render error:', err);
    }
  }

  requestAnimationFrame(render);
}

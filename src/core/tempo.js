import { DEFAULT_BPM } from './config.js';
import { runtime, tempoState } from './state.js';

export function updateTempoState() {
  const beatDuration = tempoState.beatDuration > 0 ? tempoState.beatDuration : 60 / DEFAULT_BPM;
  const barDuration = tempoState.barDuration > 0 ? tempoState.barDuration : beatDuration * 4;
  const beats = runtime.sceneData && Array.isArray(runtime.sceneData.beats) ? runtime.sceneData.beats : null;

  if (runtime.currentTime + 0.0001 < tempoState.lastBeatTime) {
    tempoState.beatIndex = 0;
    tempoState.lastBeatTime = 0;
    tempoState.nextBeatTime = beatDuration;
  }

  if (beats && beats.length > 0) {
    while (tempoState.beatIndex < beats.length && runtime.currentTime >= beats[tempoState.beatIndex]) {
      tempoState.lastBeatTime = beats[tempoState.beatIndex];
      tempoState.beatIndex += 1;
    }
    const nextIndex = Math.min(tempoState.beatIndex, beats.length - 1);
    tempoState.nextBeatTime = beats[nextIndex] > tempoState.lastBeatTime
      ? beats[nextIndex]
      : tempoState.lastBeatTime + beatDuration;
  } else {
    if (runtime.currentTime >= tempoState.nextBeatTime) {
      const steps = Math.max(1, Math.round((runtime.currentTime - tempoState.nextBeatTime) / beatDuration) + 1);
      tempoState.lastBeatTime = tempoState.nextBeatTime;
      tempoState.nextBeatTime = tempoState.lastBeatTime + beatDuration * steps;
    }
  }

  const span = Math.max(beatDuration, tempoState.nextBeatTime - tempoState.lastBeatTime);
  const beatProgress = span > 0 ? (runtime.currentTime - tempoState.lastBeatTime) / span : 0;
  const clamped = Math.max(0, Math.min(1, beatProgress));

  const beatPulse = Math.pow(Math.sin(clamped * Math.PI), 2);
  tempoState.beatPulse = beatPulse;

  const audioPulseTarget = Math.max(0, (runtime.lastAudioEnergy - 0.22) * 1.35);
  tempoState.audioPulse = THREE.MathUtils.lerp(tempoState.audioPulse, audioPulseTarget, 0.25);

  const combinedPulse = Math.min(1, beatPulse * 0.6 + tempoState.audioPulse * 0.7);
  tempoState.pulse = combinedPulse;

  tempoState.wave = Math.sin(clamped * Math.PI * 2) * (0.6 + tempoState.audioPulse * 0.4);

  const barPhase = (runtime.currentTime / barDuration) % 1;
  tempoState.barPulse = Math.pow(Math.sin(barPhase * Math.PI), 2);

  const beatAccent = Math.max(0, 1 - clamped * 8);
  const audioAccent = Math.max(0, (tempoState.audioPulse - 0.45) * 1.6);
  tempoState.accent = Math.min(1, Math.max(beatAccent, audioAccent));

  const previousEnergy = tempoState.energy;
  tempoState.energy = THREE.MathUtils.lerp(tempoState.energy, runtime.lastAudioEnergy, 0.3);

  if (runtime.hasAudio && runtime.isPlaying) {
    const energyDelta = runtime.lastAudioEnergy - previousEnergy;
    if (runtime.lastAudioEnergy > 0.55 && energyDelta > 0.08) {
      const now = runtime.currentTime;
      if ((!beats || beats.length === 0) && tempoState.lastAudioPeak > 0) {
        const interval = now - tempoState.lastAudioPeak;
        if (interval > 0.25 && interval < 1.5) {
          const detectedBeatDuration = THREE.MathUtils.clamp(interval, 60 / 220, 60 / 40);
          tempoState.beatDuration = THREE.MathUtils.lerp(tempoState.beatDuration, detectedBeatDuration, 0.12);
          tempoState.barDuration = tempoState.beatDuration * 4;
        }
      }
      tempoState.lastAudioPeak = now;
    }
  }
}

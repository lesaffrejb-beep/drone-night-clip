import { BASE_FOG_DENSITY, DEFAULT_BPM } from './config.js';

export const tempoState = {
  bpm: DEFAULT_BPM,
  beatDuration: 60 / DEFAULT_BPM,
  barDuration: (60 / DEFAULT_BPM) * 4,
  wave: 0,
  pulse: 0,
  barPulse: 0,
  accent: 0,
  beatPulse: 0,
  audioPulse: 0,
  energy: 0,
  beatIndex: 0,
  lastBeatTime: 0,
  nextBeatTime: 60 / DEFAULT_BPM,
  lastAudioPeak: 0
};

export const runtime = {
  scene: null,
  camera: null,
  renderer: null,
  composer: null,
  sceneData: null,
  currentTime: 0,
  isPlaying: false,
  playbackSpeed: 1.0,
  hudVisible: false,
  lastFrameTime: 0,
  fps: 60,
  isInitialized: false,
  cityFogDensity: BASE_FOG_DENSITY,
  windowLights: [],
  accentLights: [],
  underbridgeLights: [],
  skylineLayers: [],
  godRayMeshes: [],
  droneTrailMeshes: [],
  bridgeSearchLights: [],
  starfield: null,
  moonMesh: null,
  currentSeed: 42,
  baseExposure: 1.0,
  lastAudioEnergy: 0.2,
  cameraCurve: null,
  currentShot: null,
  cameraOscillationPhase: 0,
  audioContext: null,
  audioSource: null,
  analyser: null,
  audioData: null,
  audioElement: null,
  hasAudio: false,
  audioObjectURL: null,
  mediaRecorder: null,
  recordedChunks: [],
  isRecording: false,
  cityGroup: null,
  bridgeGroup: null,
  bloomPass: null,
  vignettePass: null,
  playPauseBtn: null,
  playbackProgressEl: null,
  modePillEl: null,
  audioFilenameEl: null,
  presetLabelEl: null,
  controlDeckEl: null,
  bpmInputEl: null
};

export function resetTempoState(bpm = DEFAULT_BPM) {
  tempoState.bpm = bpm;
  tempoState.beatDuration = 60 / bpm;
  tempoState.barDuration = tempoState.beatDuration * 4;
  tempoState.wave = 0;
  tempoState.pulse = 0;
  tempoState.barPulse = 0;
  tempoState.accent = 0;
  tempoState.beatPulse = 0;
  tempoState.audioPulse = 0;
  tempoState.energy = 0;
  tempoState.beatIndex = 0;
  tempoState.lastBeatTime = 0;
  tempoState.nextBeatTime = tempoState.beatDuration;
  tempoState.lastAudioPeak = 0;
}

export function resetEnvironmentState() {
  runtime.windowLights = [];
  runtime.accentLights = [];
  runtime.underbridgeLights = [];
  runtime.skylineLayers = [];
  runtime.godRayMeshes = [];
  runtime.droneTrailMeshes = [];
  runtime.bridgeSearchLights = [];
  runtime.starfield = null;
  runtime.moonMesh = null;
}

export function resetRecordingState() {
  runtime.mediaRecorder = null;
  runtime.recordedChunks = [];
  runtime.isRecording = false;
}

export function setSceneData(data) {
  runtime.sceneData = data;
}

export function setPlaybackState({ time, playing }) {
  if (typeof time === 'number') {
    runtime.currentTime = time;
  }
  if (typeof playing === 'boolean') {
    runtime.isPlaying = playing;
  }
}

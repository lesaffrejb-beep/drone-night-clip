/**
 * Drone Night POV V2 - Anti-Fragile B&W Edition
 * NEVER blocks on fetch, audio, or any async operation
 * Works in file://, with missing JSON, without audio
 */

(function() {
  'use strict';

  const LOG_PREFIX = '[DRONE]';

  const TARGET_WIDTH = 1080;
  const TARGET_HEIGHT = 1920;
  const TARGET_ASPECT = TARGET_WIDTH / TARGET_HEIGHT;
  const TARGET_DURATION = 30;
  const DEFAULT_BPM = 120;

  const tempoState = {
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

  // ============================================================================
  // GLOBAL STATE
  // ============================================================================

  let scene, camera, renderer, composer;
  let sceneData = null; // Can be null, always check before use
  let currentTime = 0;
  let isPlaying = false;
  let playbackSpeed = 1.0;
  let hudVisible = false;
  let lastFrameTime = 0;
  let fps = 60;
  let isInitialized = false;

  const BASE_FOG_DENSITY = 0.015;
  let cityFogDensity = BASE_FOG_DENSITY;

  let windowLights = [];
  let accentLights = [];
  let underbridgeLights = [];
  let skylineLayers = [];
  let godRayMeshes = [];
  let droneTrailMeshes = [];
  let bridgeSearchLights = [];
  let starfield = null;
  let moonMesh = null;
  let currentSeed = 42;

  let baseExposure = 1.0;
  let lastAudioEnergy = 0.2;

  // Camera path
  let cameraCurve = null;
  let currentShot = null;
  let cameraOscillationPhase = 0;

  // Audio (optional)
  let audioContext = null;
  let audioSource = null;
  let analyser = null;
  let audioData = null;
  let audioElement = null;
  let hasAudio = false;
  let audioObjectURL = null;

  // Recording
  let mediaRecorder = null;
  let recordedChunks = [];
  let isRecording = false;

  // Scene objects
  let cityGroup = null;
  let bridgeGroup = null;

  // Post-processing
  let bloomPass = null;
  let vignettePass = null;

  // UI references
  let playPauseBtn = null;
  let playbackProgressEl = null;
  let modePillEl = null;
  let audioFilenameEl = null;
  let presetLabelEl = null;
  let controlDeckEl = null;
  let bpmInputEl = null;

  // ============================================================================
  // INITIALIZATION - TWO PHASE (NEVER BLOCKS)
  // ============================================================================

  async function init() {
    console.log(LOG_PREFIX, 'Starting init...');

    const canvas = document.getElementById('canvas');
    const initStatus = document.getElementById('init-status');

    // Phase 1: Core setup (synchronous, never fails)
    try {
      // Check WebGL
      if (!isWebGLAvailable()) {
        console.warn(LOG_PREFIX, 'WebGL not available, using 2D fallback');
        if (window.initFallback2D) {
          setTimeout(() => window.initFallback2D(), 100);
        }
        return;
      }

      console.log(LOG_PREFIX, 'WebGL available');

      // Setup Three.js core (always succeeds)
      setupRenderer(canvas);
      setupScene();
      setupCamera();
      setupLights();

      // Setup UI FIRST (critical for Play button to work)
      setupUI();
      setupKeyboard();

      console.log(LOG_PREFIX, 'Core systems initialized');
      initStatus.textContent = 'Loading scene...';

      // Phase 2: Load scene data (async, non-blocking)
      // This runs in background, UI is already functional
      loadSceneDataAsync().then(() => {
        console.log(LOG_PREFIX, 'Scene data loaded');
      }).catch(err => {
        console.warn(LOG_PREFIX, 'Scene load failed, using fallback:', err);
      }).finally(() => {
        // Always continue, even if scene load failed
        finishInit();
      });

    } catch (error) {
      console.error(LOG_PREFIX, 'Critical init error:', error);
      initStatus.textContent = 'Error: ' + error.message;
      // Still try to setup basic UI
      try {
        setupUI();
        setupKeyboard();
      } catch (e) {
        console.error(LOG_PREFIX, 'UI setup failed:', e);
      }
    }
  }

  async function loadSceneDataAsync() {
    // Try to load scene.json with timeout, but don't block if it fails
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

      const response = await fetch('scene.json', { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      sceneData = normalizeSceneData(await response.json());
      console.log(LOG_PREFIX, '✓ Loaded scene.json');
    } catch (err) {
      console.warn(LOG_PREFIX, 'Failed to fetch scene.json:', err.message);
      // Fallback to inline scene
      sceneData = normalizeSceneData(loadInlineScene());
    }
  }

  function loadInlineScene() {
    console.log(LOG_PREFIX, 'Using inline fallback scene');
    try {
      const scriptEl = document.getElementById('scene-inline');
      if (!scriptEl) {
        throw new Error('Inline scene not found');
      }
      const data = JSON.parse(scriptEl.textContent);
      showStatus('Local mode (inline scene)', 3000);
      return data;
    } catch (err) {
      console.error(LOG_PREFIX, 'Inline scene parse failed:', err);
      // Last resort: minimal hardcoded scene
      return createMinimalScene();
    }
  }

  function createMinimalScene() {
    console.warn(LOG_PREFIX, 'Using emergency minimal scene');
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

  function regenerateBeats(data) {
    if (!data || !data.meta) return;
    const bpm = data.meta.bpm || DEFAULT_BPM;
    const beatDuration = 60 / bpm;
    const beats = [];
    for (let t = 0; t <= data.meta.duration + 0.0001; t += beatDuration) {
      beats.push(parseFloat(t.toFixed(4)));
    }
    data.beats = beats;
  }

  function normalizeSceneData(data) {
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

  function finishInit() {
    console.log(LOG_PREFIX, 'Finishing init...');

    try {
      console.log(LOG_PREFIX, 'Applying scene data...');
      applySceneData(sceneData);
      console.log(LOG_PREFIX, '✓ Scene applied');

      console.log(LOG_PREFIX, 'Setting up post-processing...');
      setupPostProcessing();
      console.log(LOG_PREFIX, '✓ Post-processing setup complete');

      // Start render loop (ALWAYS, even if scene data is missing)
      lastFrameTime = performance.now();
      requestAnimationFrame(render);
      console.log(LOG_PREFIX, '✓ Render loop started');

      // Mark as initialized
      isInitialized = true;

      syncPlayStateUI();

      // Show UI controls after a brief moment
      setTimeout(() => {
        console.log(LOG_PREFIX, 'Showing UI controls...');
        const spinner = document.getElementById('init-spinner');
        const status = document.getElementById('init-status');
        const buttons = document.getElementById('splash-buttons');
        const controls = document.getElementById('splash-controls');
        const instructions = document.getElementById('instructions-box');

        if (spinner) {
          spinner.classList.add('hidden');
          console.log(LOG_PREFIX, '✓ Spinner hidden');
        }
        if (status) {
          status.textContent = '✓ Ready';
          status.className = 'success';
          console.log(LOG_PREFIX, '✓ Status updated to Ready');
        }
        if (buttons) {
          buttons.style.display = 'flex';
          console.log(LOG_PREFIX, '✓ Start button visible');
        }
        if (controls) {
          controls.style.display = 'flex';
          console.log(LOG_PREFIX, '✓ Controls visible');
        }

        if (instructions) {
          instructions.style.display = 'block';
          console.log(LOG_PREFIX, '✓ Instructions visible');
        }

        if (controlDeckEl) {
          controlDeckEl.classList.add('visible');
        }
      }, 500);

      console.log(LOG_PREFIX, '✓ Initialization complete, render loop started');
    } catch (error) {
      console.error(LOG_PREFIX, 'ERROR in finishInit():', error);
      console.error(LOG_PREFIX, 'Error stack:', error.stack);

      // Distinguish between fatal and non-fatal errors
      const isFatal = !composer || !renderer || !scene || !camera;

      // Try to show error to user
      const status = document.getElementById('init-status');
      if (status) {
        if (isFatal) {
          status.textContent = 'Init error: ' + error.message;
          status.className = 'error';
        } else {
          // Non-fatal: probably post-FX issue, show safe mode
          status.textContent = '✓ Ready (safe mode)';
          status.className = 'success';
          console.warn(LOG_PREFIX, 'Starting in safe mode due to non-fatal error');
        }
      }

      // Always try to show start button and start render loop
      setTimeout(() => {
        const spinner = document.getElementById('init-spinner');
        const buttons = document.getElementById('splash-buttons');
        if (spinner) spinner.classList.add('hidden');
        if (buttons) buttons.style.display = 'flex';
      }, 500);

      // Try to start render loop if we have the basics
      if (!isFatal && composer && !isInitialized) {
        lastFrameTime = performance.now();
        requestAnimationFrame(render);
        isInitialized = true;
        console.log(LOG_PREFIX, '✓ Render loop started (recovery mode)');
      }
    }
  }

  function isWebGLAvailable() {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  function setupRenderer(canvas) {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true
    });

    renderer.setSize(TARGET_WIDTH, TARGET_HEIGHT, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95; // Cinematic black & white base
    console.log(LOG_PREFIX, 'Renderer setup');
  }

  function setupScene() {
    scene = new THREE.Scene();
    // Black & white palette
    scene.background = new THREE.Color(0x000000);
    cityFogDensity = BASE_FOG_DENSITY;
    scene.fog = new THREE.FogExp2(0x000000, cityFogDensity);
    console.log(LOG_PREFIX, 'Scene setup (B&W mode)');
  }

  function setupCamera() {
    camera = new THREE.PerspectiveCamera(68, TARGET_ASPECT, 0.1, 400);
    camera.position.set(0, 32, 90);
    camera.lookAt(0, 0, 0);
    console.log(LOG_PREFIX, 'Camera setup');
  }

  function setupLights() {
    // Monochrome lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.15);
    scene.add(ambient);

    const moon = new THREE.DirectionalLight(0xffffff, 0.25);
    moon.position.set(50, 100, 50);
    scene.add(moon);

    const hemi = new THREE.HemisphereLight(0x222222, 0x000000, 0.3);
    scene.add(hemi);

    console.log(LOG_PREFIX, 'Lights setup (monochrome)');
  }

  // ============================================================================
  // PROCEDURAL CITY GENERATION (B&W)
  // ============================================================================

  function setupCity(seed) {
    cityGroup = new THREE.Group();
    scene.add(cityGroup);

    const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
    const windowGeo = new THREE.PlaneGeometry(0.3, 0.4);

    let rng = seededRandom(seed);

    windowLights = [];
    accentLights = [];
    skylineLayers = [];
    godRayMeshes = [];
    droneTrailMeshes = [];
    starfield = null;
    moonMesh = null;

    const gridSize = 120;
    const blockSize = 12;
    let buildingCount = 0;

    for (let x = -gridSize; x < gridSize; x += blockSize) {
      for (let z = -gridSize; z < gridSize; z += blockSize) {
        // Skip camera path
        if (x > -12 && x < 18 && z > -120 && z < 160) continue;

        const numBuildings = Math.floor(rng() * 3) + 1;

        for (let i = 0; i < numBuildings; i++) {
          const bx = x + (rng() - 0.5) * blockSize * 0.8;
          const bz = z + (rng() - 0.5) * blockSize * 0.8;
          const width = 2 + rng() * 3;
          const depth = 2 + rng() * 3;
          const height = 5 + rng() * 25;

          // Building body (dark gray/black)
          const buildingMat = new THREE.MeshLambertMaterial({
            color: new THREE.Color(0.01, 0.01, 0.01), // Nearly black
            flatShading: true
          });

          const building = new THREE.Mesh(buildingGeo, buildingMat);
          building.scale.set(width, height, depth);
          building.position.set(bx, height / 2, bz);
          cityGroup.add(building);
          buildingCount++;

          // Windows (ivory/white only)
          const windowCount = Math.floor(height / 2) * 4;
          // Desaturate - use grayscale values only
          const brightness = 0.85 + rng() * 0.15; // 0.85-1.0 range
          const windowColor = new THREE.Color(brightness, brightness, brightness);

          const windowMat = new THREE.MeshBasicMaterial({
            color: windowColor,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.75
          });

          for (let w = 0; w < windowCount; w++) {
            if (rng() > 0.35) {
              const window = new THREE.Mesh(windowGeo, windowMat.clone());
              const side = Math.floor(rng() * 4);
              const wy = 2 + (rng() * (height - 4));

              if (side === 0) window.position.set(bx + width/2, wy, bz);
              else if (side === 1) window.position.set(bx - width/2, wy, bz);
              else if (side === 2) window.position.set(bx, wy, bz + depth/2);
              else window.position.set(bx, wy, bz - depth/2);

              if (side < 2) window.rotation.y = Math.PI / 2;

              window.userData.base = 0.4 + rng() * 0.5;
              window.userData.flicker = 0.3 + rng() * 0.6;
              windowLights.push(window);
              cityGroup.add(window);
            }
          }

          // Rooftop accents (subtle white/gray)
          if (rng() > 0.85) {
            const accentColor = new THREE.Color(0.9, 0.9, 0.9);
            const accentMat = new THREE.MeshBasicMaterial({
              color: accentColor,
              transparent: true,
              opacity: 0.6
            });
            const accent = new THREE.Mesh(
              new THREE.BoxGeometry(width * 0.8, 0.2, depth * 0.8),
              accentMat
            );
            accent.position.set(bx, height + 0.1, bz);
            accent.userData.base = 0.3 + rng() * 0.4;
            accent.userData.flicker = 0.2 + rng() * 0.4;
            accentLights.push(accent);
            cityGroup.add(accent);
          }
        }
      }
    }

    // Ground plane (dark)
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshLambertMaterial({
      color: 0x050505,
      side: THREE.DoubleSide
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    cityGroup.add(ground);

    createParallaxSkyline(cityGroup, seededRandom(seed + 101));
    createCelestialElements(cityGroup, seededRandom(seed + 202));
    createDroneTrails(cityGroup, seededRandom(seed + 303));

    console.log(LOG_PREFIX, `City generated: ${buildingCount} buildings (B&W)`);
  }

  function createParallaxSkyline(parent, rng) {
    const layers = [
      { depth: -140, opacity: 0.28, brightness: 0.14, parallax: 0.22, min: 18, max: 44 },
      { depth: -180, opacity: 0.22, brightness: 0.18, parallax: 0.16, min: 26, max: 58 },
      { depth: -220, opacity: 0.18, brightness: 0.22, parallax: 0.12, min: 32, max: 74 }
    ];

    layers.forEach((layer, index) => {
      const skyline = new THREE.Group();
      skyline.position.z = layer.depth;

      for (let x = -200; x <= 200; x += 5) {
        const width = 3 + rng() * 7;
        const height = layer.min + rng() * (layer.max - layer.min);
        const geometry = new THREE.PlaneGeometry(1, 1);
        const brightness = layer.brightness + rng() * 0.08 + index * 0.03;
        const material = new THREE.MeshBasicMaterial({
          color: new THREE.Color(brightness, brightness, brightness),
          transparent: true,
          opacity: layer.opacity,
          depthWrite: false
        });

        const slab = new THREE.Mesh(geometry, material);
        slab.scale.set(width, height, 1);
        slab.position.set(x + rng() * 3, height / 2 + 4 * index, 0);
        slab.userData.baseOpacity = layer.opacity;
        slab.userData.flicker = 0.5 + rng() * 0.8;
        skyline.add(slab);
      }

      skylineLayers.push({ group: skyline, parallax: layer.parallax });
      parent.add(skyline);
    });
  }

  function createCelestialElements(parent, rng) {
    const starCount = 320;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = (rng() - 0.5) * 380;
      positions[i * 3 + 1] = 40 + rng() * 140;
      positions[i * 3 + 2] = -160 - rng() * 160;
    }

    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.9,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.32,
      depthWrite: false
    });

    starfield = new THREE.Points(starGeometry, starMaterial);
    starfield.userData.baseOpacity = 0.3;
    parent.add(starfield);

    const moonGeo = new THREE.CircleGeometry(7.5, 64);
    const moonMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.position.set(-46, 88, -190);
    moonMesh.userData.baseOpacity = 0.82;
    parent.add(moonMesh);

    const moonGlowGeo = new THREE.CircleGeometry(12, 64);
    const moonGlowMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const moonGlow = new THREE.Mesh(moonGlowGeo, moonGlowMat);
    moonGlow.position.copy(moonMesh.position);
    moonGlow.userData = { baseOpacity: 0.18, swing: 0, speed: 0, isGlow: true };
    parent.add(moonGlow);
    godRayMeshes.push(moonGlow);

    const rayGeo = new THREE.PlaneGeometry(24, 170);
    for (let i = 0; i < 4; i++) {
      const opacity = 0.07 + rng() * 0.05;
      const rayMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const ray = new THREE.Mesh(rayGeo.clone(), rayMat);
      ray.position.set(-46 + i * 7, 42 + rng() * 10, -170 - i * 12);
      ray.rotation.set(-Math.PI / 2 + 0.12 * (i % 2 === 0 ? 1 : -1), 0.14 * (i - 1.5), 0);
      ray.userData = {
        baseOpacity: opacity,
        swing: 0.25 + rng() * 0.25,
        speed: 0.25 + rng() * 0.18,
        isGlow: false
      };
      parent.add(ray);
      godRayMeshes.push(ray);
    }
  }

  function createDroneTrails(parent, rng) {
    const curves = [
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-44, 42, 130),
        new THREE.Vector3(-20, 36, 90),
        new THREE.Vector3(-6, 28, 50),
        new THREE.Vector3(8, 22, 12)
      ]),
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(12, 12, 36),
        new THREE.Vector3(9, 8, 12),
        new THREE.Vector3(7, 6.5, -18),
        new THREE.Vector3(5, 7, -52)
      ]),
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(4, 6, -14),
        new THREE.Vector3(6, 5.4, -28),
        new THREE.Vector3(8.5, 5.2, -44),
        new THREE.Vector3(12, 6.2, -68)
      ])
    ];

    curves.forEach((curve) => {
      const geometry = new THREE.TubeGeometry(curve, 220, 0.18 + rng() * 0.08, 12, false);
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.baseOpacity = 0.2 + rng() * 0.25;
      mesh.userData.offset = rng() * Math.PI * 2;
      mesh.userData.wave = 0.5 + rng() * 0.7;
      parent.add(mesh);
      droneTrailMeshes.push(mesh);
    });
  }

  // ============================================================================
  // BRIDGE SETUP (B&W)
  // ============================================================================

  function setupBridge() {
    bridgeGroup = new THREE.Group();
    scene.add(bridgeGroup);

    underbridgeLights = [];
    bridgeSearchLights = [];

    const archCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(3, 3, 4),
      new THREE.Vector3(7, 9, 6),
      new THREE.Vector3(11, 3, 8)
    );

    const archPoints = archCurve.getPoints(20);
    const archGeo = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(archPoints),
      20,
      0.5,
      8,
      false
    );

    // Dark gray bridge
    const archMat = new THREE.MeshLambertMaterial({
      color: 0x111111,
      flatShading: true
    });

    const arch = new THREE.Mesh(archGeo, archMat);
    bridgeGroup.add(arch);

    // Deck
    const deckGeo = new THREE.BoxGeometry(10, 0.4, 12);
    const deck = new THREE.Mesh(deckGeo, archMat);
    deck.position.set(7, 8, 6);
    bridgeGroup.add(deck);

    // Underlight (white/gray)
    const lightMat = new THREE.MeshBasicMaterial({
      color: 0xeeeeee,
      transparent: true,
      opacity: 0.5
    });
    const underlight = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.1, 11),
      lightMat
    );
    underlight.position.set(7, 7.8, 6);
    underlight.userData.base = 0.35;
    underlight.userData.flicker = 0.25;
    underbridgeLights.push(underlight);
    bridgeGroup.add(underlight);

    const lampGeo = new THREE.CylinderGeometry(0.08, 0.12, 3.2, 12);
    const lampMat = new THREE.MeshLambertMaterial({ color: 0x0b0b0b });
    const lampCapGeo = new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const lampLightMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.45
    });

    const lampRng = seededRandom(currentSeed + 1337);

    for (let i = -4; i <= 4; i++) {
      const post = new THREE.Mesh(lampGeo, lampMat);
      post.position.set(7 + i * 1.6, 6.6, 6 + (i % 2 === 0 ? 2.8 : -2.8));
      bridgeGroup.add(post);

      const cap = new THREE.Mesh(lampCapGeo, lampLightMat.clone());
      cap.position.set(post.position.x, 8.2, post.position.z);
      cap.rotation.x = Math.PI;
      cap.userData.base = 0.25 + lampRng() * 0.35;
      cap.userData.flicker = 0.4 + lampRng() * 0.5;
      underbridgeLights.push(cap);
      bridgeGroup.add(cap);
    }

    const beamGeo = new THREE.ConeGeometry(1.1, 10, 28, 1, true).rotateX(Math.PI);
    for (let i = -1; i <= 1; i++) {
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.16 + lampRng() * 0.08,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });
      const beam = new THREE.Mesh(beamGeo.clone(), beamMat);
      beam.position.set(7 + i * 2.6, 8.35, 6);
      beam.userData.baseOpacity = beam.material.opacity;
      beam.userData.speed = 0.6 + lampRng() * 0.4;
      bridgeGroup.add(beam);
      bridgeSearchLights.push(beam);
    }

    console.log(LOG_PREFIX, 'Bridge created (B&W)');
  }

  function disposeGroup(group) {
    if (!group) return;
    group.traverse((child) => {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat && mat.dispose && mat.dispose());
        } else if (child.material.dispose) {
          child.material.dispose();
        }
      }
    });
  }

  function clearEnvironment() {
    if (cityGroup) {
      disposeGroup(cityGroup);
      scene.remove(cityGroup);
      cityGroup = null;
    }
    if (bridgeGroup) {
      disposeGroup(bridgeGroup);
      scene.remove(bridgeGroup);
      bridgeGroup = null;
    }
    windowLights = [];
    accentLights = [];
    underbridgeLights = [];
    skylineLayers = [];
    godRayMeshes = [];
    droneTrailMeshes = [];
    bridgeSearchLights = [];
    starfield = null;
    moonMesh = null;
  }

  function rebuildEnvironmentForScene() {
    clearEnvironment();
    setupCity(currentSeed);
    setupBridge();
  }

  function applySceneData(data, statusMessage) {
    sceneData = normalizeSceneData(data);
    currentSeed = sceneData.meta.seed || 42;
    tempoState.bpm = sceneData.meta.bpm;
    tempoState.beatDuration = 60 / tempoState.bpm;
    tempoState.barDuration = tempoState.beatDuration * 4;
    tempoState.beatIndex = 0;
    tempoState.lastBeatTime = 0;
    tempoState.nextBeatTime = tempoState.beatDuration;
    tempoState.audioPulse = 0;
    tempoState.beatPulse = 0;
    tempoState.energy = 0;
    tempoState.lastAudioPeak = 0;
    tempoState.wave = 0;
    tempoState.pulse = 0;
    tempoState.barPulse = 0;
    tempoState.accent = 0;
    cityFogDensity = BASE_FOG_DENSITY;
    if (scene && scene.fog) {
      scene.fog.density = cityFogDensity;
    }
    rebuildEnvironmentForScene();
    currentShot = null;
    cameraCurve = null;
    updateTimeline();
    refreshPresetUI(sceneData);
    if (statusMessage) {
      showStatus(statusMessage, 2000);
    }
  }

  // ============================================================================
  // POST-PROCESSING (B&W OPTIMIZED)
  // ============================================================================

  function setupPostProcessing() {
    const width = TARGET_WIDTH;
    const height = TARGET_HEIGHT;

    // Defensive polyfill: ensure CopyShader exists (required by many passes)
    if (!THREE.CopyShader) {
      console.warn(LOG_PREFIX, 'CopyShader missing, creating polyfill');
      THREE.CopyShader = {
        uniforms: { tDiffuse: { value: null }, opacity: { value: 1.0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'uniform sampler2D tDiffuse; uniform float opacity; varying vec2 vUv; void main(){ vec4 c=texture2D(tDiffuse,vUv); gl_FragColor=vec4(c.rgb, c.a*opacity); }'
      };
    }

    // Always start with EffectComposer and basic RenderPass
    composer = new THREE.EffectComposer(renderer);
    const renderPass = new THREE.RenderPass(scene, camera);
    composer.addPass(renderPass);
    console.log(LOG_PREFIX, 'Basic render pass created');

    try {
      // Validate hard dependencies for UnrealBloomPass
      if (!THREE.CopyShader) {
        throw new Error('CopyShader missing');
      }
      if (!THREE.LuminosityHighPassShader) {
        throw new Error('LuminosityHighPassShader missing');
      }

      // Create bloom pass
      bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(width, height),
        0.45,
        0.8,
        0.85
      );
      composer.addPass(bloomPass);
      console.log(LOG_PREFIX, '✓ Bloom pass created');

      // Vignette + Grain shader (B&W only)
      // Create ShaderMaterial directly to avoid UniformsUtils dependency
      const bwMaterial = new THREE.ShaderMaterial({
        uniforms: {
          tDiffuse: { value: null },
          uVignette: { value: 0.4 },
          uGrain: { value: 0.12 },
          uTime: { value: 0 },
          uPulse: { value: 0 },
          uAccent: { value: 0 },
          uSparkle: { value: 0 }
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D tDiffuse;
          uniform float uVignette;
          uniform float uGrain;
          uniform float uTime;
          uniform float uPulse;
          uniform float uAccent;
          uniform float uSparkle;
          varying vec2 vUv;

          float rand(vec2 co) {
            return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453);
          }

          void main() {
            vec2 uv = vUv;
            vec3 color = texture2D(tDiffuse, uv).rgb;

            float vignette = smoothstep(0.62 + uSparkle * 0.12, uVignette + 1.08, distance(uv, vec2(0.5)));
            float grain = (rand(uv * 18.0 + uTime * 0.65) - 0.5) * uGrain;
            float scan = sin((uv.y + uTime * 0.35) * 380.0) * 0.0035 * (0.4 + uSparkle * 1.2);
            float pulseGlow = (uPulse * 0.06) + (uAccent * 0.12);

            color = mix(color, vec3(dot(color, vec3(0.299, 0.587, 0.114))), 0.3);
            color += grain + scan + pulseGlow;
            color *= (1.0 - vignette * 0.42);
            color = clamp(color, 0.0, 1.4);
            gl_FragColor = vec4(color, 1.0);
          }
        `
      });

      vignettePass = new THREE.ShaderPass(bwMaterial);
      vignettePass.renderToScreen = true;
      composer.addPass(vignettePass);
      console.log(LOG_PREFIX, '✓ B&W vignette pass created');

      console.log(LOG_PREFIX, '✓ Post-processing setup complete (full FX)');
    } catch (error) {
      console.warn(LOG_PREFIX, 'Post-FX disabled (safe mode):', error.message);
      // Composer already has renderPass, so playback will still work
      // Just render directly without effects
      renderPass.renderToScreen = true;
      showStatus('Post-FX disabled (safe mode)', 3000);
    }
  }

  // ============================================================================
  // CAMERA PATH & ANIMATION (SAFE, CHECKS sceneData)
  // ============================================================================

  function updateCameraPath() {
    if (!sceneData || !sceneData.shots || !Array.isArray(sceneData.shots) || sceneData.shots.length === 0) {
      return;
    }

    let shot = null;
    for (const s of sceneData.shots) {
      if (currentTime >= s.time[0] && currentTime < s.time[1]) {
        shot = s;
        break;
      }
    }

    if (!shot) {
      shot = sceneData.shots[sceneData.shots.length - 1];
    }

    if (currentShot !== shot) {
      currentShot = shot;
      try {
        const points = shot.path.points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
        cameraCurve = new THREE.CatmullRomCurve3(points);
        cameraOscillationPhase = 0;
      } catch (err) {
        console.error(LOG_PREFIX, 'Failed to build camera curve:', err);
        return;
      }
    }

    if (!cameraCurve) return;

    const shotDuration = Math.max(shot.time[1] - shot.time[0], 0.0001);
    const shotProgress = (currentTime - shot.time[0]) / shotDuration;
    let t = Math.max(0, Math.min(1, shotProgress));

    const tempoWarp = shot.camera && shot.camera.tempoWarp ? shot.camera.tempoWarp : 0;
    if (tempoWarp !== 0) {
      t += tempoState.wave * tempoWarp * 0.05 + tempoState.pulse * tempoWarp * 0.03;
      t = Math.max(0, Math.min(1, t));
    }

    const easedT = applyEasing(t, shot.camera && shot.camera.ease ? shot.camera.ease : 'smooth');
    const lookAheadT = Math.min(1, easedT + 0.04);

    try {
      const pos = cameraCurve.getPoint(easedT);
      camera.position.copy(pos);

      const oscillation = shot.camera.oscillation || 0;
      if (oscillation > 0) {
        cameraOscillationPhase += 0.08 + tempoState.pulse * 0.12;
        camera.position.x += Math.sin(cameraOscillationPhase * 2.3) * oscillation * 0.3;
        camera.position.y += Math.sin(cameraOscillationPhase * 3.1) * oscillation * 0.22;
        camera.position.z += Math.sin(cameraOscillationPhase * 1.7) * oscillation * 0.18;
      }

      const tempoShake = shot.camera && shot.camera.tempoShake ? shot.camera.tempoShake : 0;
      if (tempoShake > 0) {
        camera.position.x += Math.sin(currentTime * 18.0) * tempoShake * tempoState.pulse * 0.25;
        camera.position.y += Math.cos(currentTime * 12.0) * tempoShake * tempoState.pulse * 0.18;
      }

      if (shot.camera && shot.camera.tempoLift) {
        camera.position.y += shot.camera.tempoLift * (tempoState.pulse * 0.5 + tempoState.accent * 0.5);
      }

      const lookAt = cameraCurve.getPoint(lookAheadT);
      camera.lookAt(lookAt);

      let fov = THREE.MathUtils.lerp(shot.camera.fov[0], shot.camera.fov[1], easedT);
      const tempoFov = shot.camera && shot.camera.tempoFov ? shot.camera.tempoFov : 0;
      if (tempoFov) {
        fov += tempoFov * (tempoState.pulse + tempoState.accent * 0.5 + lastAudioEnergy * 0.7);
      }
      camera.fov = fov;
      camera.updateProjectionMatrix();

      const baseRoll = THREE.MathUtils.lerp(
        shot.camera.rollDeg[0] * Math.PI / 180,
        shot.camera.rollDeg[1] * Math.PI / 180,
        easedT
      );

      let beatJitter = 0;
      if (sceneData.beats && Array.isArray(sceneData.beats)) {
        const nearestBeat = sceneData.beats.reduce((prev, curr) =>
          Math.abs(curr - currentTime) < Math.abs(prev - currentTime) ? curr : prev
        );
        const beatDist = Math.abs(nearestBeat - currentTime);
        if (beatDist < 0.08) {
          beatJitter = (0.08 - beatDist) * 0.6;
        }
      }

      const tempoRoll = shot.camera && shot.camera.tempoRoll ? shot.camera.tempoRoll * tempoState.wave : 0;
      const accentRoll = shot.camera && shot.camera.accentRoll ? shot.camera.accentRoll * tempoState.accent : 0;
      camera.rotation.z = baseRoll + beatJitter + tempoRoll + accentRoll;

      if (shot.camera && shot.camera.tempoPush) {
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        camera.position.addScaledVector(direction, shot.camera.tempoPush * (tempoState.pulse * 0.6 + tempoState.accent * 0.4));
      }

      updateFX(shot, easedT);

      let exposure = baseExposure;
      if (shot.fx.fade) {
        const [fadeStart, fadeEnd] = shot.fx.fade;
        if (currentTime >= fadeStart) {
          const fadeT = (currentTime - fadeStart) / (fadeEnd - fadeStart);
          const opacity = 1 - Math.min(1, fadeT);
          exposure *= opacity;
        }
      }

      renderer.toneMappingExposure = exposure;

    } catch (err) {
      console.error(LOG_PREFIX, 'Camera update error:', err);
    }
  }

  function updateFX(shot, t) {
    const audioEnergy = lastAudioEnergy;
    const combinedPulse = tempoState.pulse;
    const accent = tempoState.accent;
    const wave = tempoState.wave;
    const beatPulse = tempoState.beatPulse;
    const audioPulse = tempoState.audioPulse;

    if (shot.fx && shot.fx.bloom && bloomPass) {
      const bloomBase = THREE.MathUtils.lerp(shot.fx.bloom[0], shot.fx.bloom[1], t);
      const neon = shot.fx.neonPulse || 0;
      const bloomPulse = neon * (audioEnergy * 0.7 + combinedPulse * 0.45 + accent * 0.6 + Math.abs(wave) * 0.2);
      bloomPass.strength = bloomBase + bloomPulse;
    }

    if (shot.fx && shot.fx.vignette && vignettePass && vignettePass.uniforms) {
      const vignetteVal = THREE.MathUtils.lerp(shot.fx.vignette[0], shot.fx.vignette[1], t);
      vignettePass.uniforms.uVignette.value = vignetteVal;
      vignettePass.uniforms.uTime.value = currentTime * (1.0 + (shot.fx.sparkle || 0) * 0.6);
      vignettePass.uniforms.uGrain.value = 0.16 + audioEnergy * 0.12 + (shot.fx.sparkle || 0) * 0.14 + beatPulse * 0.05;

      if (vignettePass.uniforms.uPulse) {
        vignettePass.uniforms.uPulse.value = combinedPulse;
      }
      if (vignettePass.uniforms.uAccent) {
        vignettePass.uniforms.uAccent.value = accent;
      }
      if (vignettePass.uniforms.uSparkle) {
        const sparkleTarget = (shot.fx.sparkle || 0) * (combinedPulse * 0.6 + accent * 0.7 + audioEnergy * 0.8 + audioPulse * 0.5 + Math.abs(wave) * 0.3);
        vignettePass.uniforms.uSparkle.value = THREE.MathUtils.lerp(
          vignettePass.uniforms.uSparkle.value,
          sparkleTarget,
          0.2
        );
      }
    }

    const exposureBase = shot.fx && typeof shot.fx.exposure === 'number' ? shot.fx.exposure : 0.95;
    const flash = shot.fx && shot.fx.flash ? shot.fx.flash : 0;
    const accentFlash = shot.fx && shot.fx.accentFlash ? shot.fx.accentFlash : 0;
    baseExposure = exposureBase + flash * (combinedPulse + audioEnergy * 0.8) + accentFlash * accent;
    baseExposure = Math.max(0.25, Math.min(1.8, baseExposure));

    if (scene && scene.fog) {
      const hazeBase = shot.fx && typeof shot.fx.haze === 'number' ? shot.fx.haze : BASE_FOG_DENSITY;
      const hazePulse = shot.fx && shot.fx.hazePulse ? shot.fx.hazePulse : 0;
      const fogTarget = hazeBase + hazePulse * (combinedPulse + accent * 0.5 + audioEnergy * 0.5);
      cityFogDensity = THREE.MathUtils.lerp(cityFogDensity, fogTarget, 0.05);
      scene.fog.density = cityFogDensity;
    }
  }

  function updateCityLights() {
    const sparkle = currentShot && currentShot.fx ? (currentShot.fx.sparkle || 0) : 0;
    const pulse = tempoState.pulse;
    const accent = tempoState.accent;
    const audioPulse = tempoState.audioPulse;
    const energy = lastAudioEnergy;

    windowLights.forEach((mesh) => {
      if (!mesh.material || Array.isArray(mesh.material)) return;
      const base = mesh.userData && mesh.userData.base ? mesh.userData.base : 0.45;
      const flicker = mesh.userData && mesh.userData.flicker ? mesh.userData.flicker : 0.35;
      const target = base + (pulse * 0.7 + accent * 0.6 + energy * 0.8 + audioPulse * 0.6) * flicker * (0.7 + sparkle * 0.6);
      mesh.material.opacity = THREE.MathUtils.lerp(mesh.material.opacity, Math.min(1.0, target), 0.3);
    });

    accentLights.forEach((mesh) => {
      if (!mesh.material || Array.isArray(mesh.material)) return;
      const base = mesh.userData && mesh.userData.base ? mesh.userData.base : 0.3;
      const flicker = mesh.userData && mesh.userData.flicker ? mesh.userData.flicker : 0.25;
      const target = base + (pulse * 0.5 + energy * 0.6 + audioPulse * 0.5) * flicker;
      mesh.material.opacity = THREE.MathUtils.lerp(mesh.material.opacity, Math.min(1.0, target), 0.25);
    });

    underbridgeLights.forEach((mesh) => {
      if (!mesh.material || Array.isArray(mesh.material)) return;
      const base = mesh.userData && mesh.userData.base ? mesh.userData.base : 0.28;
      const flicker = mesh.userData && mesh.userData.flicker ? mesh.userData.flicker : 0.3;
      const target = base + (pulse * 0.8 + accent * 0.6 + energy * 0.5 + audioPulse * 0.5) * flicker;
      mesh.material.opacity = THREE.MathUtils.lerp(mesh.material.opacity, Math.min(1.0, target), 0.28);
    });
  }

  function updateCinematicElements(deltaSeconds) {
    deltaSeconds = Number.isFinite(deltaSeconds) ? deltaSeconds : 0;
    const pulse = tempoState.pulse;
    const accent = tempoState.accent;
    const audioPulse = tempoState.audioPulse;
    const energy = tempoState.energy;
    const time = currentTime;

    if (camera) {
      skylineLayers.forEach((layer) => {
        if (!layer || !layer.group) return;
        const parallax = typeof layer.parallax === 'number' ? layer.parallax : 0.1;
        layer.group.position.x = -camera.position.x * parallax;
        layer.group.children.forEach((child) => {
          if (!child.material) return;
          const base = child.userData && child.userData.baseOpacity ? child.userData.baseOpacity : 0.2;
          const flicker = child.userData && child.userData.flicker ? child.userData.flicker : 0.5;
          const target = base + (pulse * 0.08 + audioPulse * 0.16 + accent * 0.12 + energy * 0.12) * flicker;
          child.material.opacity = THREE.MathUtils.lerp(child.material.opacity, Math.min(1.0, target), 0.08);
        });
      });
    }

    if (moonMesh && moonMesh.material) {
      const base = moonMesh.userData && moonMesh.userData.baseOpacity ? moonMesh.userData.baseOpacity : 0.78;
      const target = base + (accent * 0.24 + audioPulse * 0.28 + energy * 0.22);
      moonMesh.material.opacity = THREE.MathUtils.lerp(moonMesh.material.opacity, Math.min(1.2, target), 0.12);
      moonMesh.rotation.z = Math.sin(time * 0.05) * 0.04;
    }

    godRayMeshes.forEach((mesh, index) => {
      if (!mesh || !mesh.material) return;
      const base = mesh.userData && mesh.userData.baseOpacity ? mesh.userData.baseOpacity : 0.1;
      const swing = mesh.userData && mesh.userData.swing ? mesh.userData.swing : 0;
      const speed = mesh.userData && mesh.userData.speed ? mesh.userData.speed : 0.2;
      const target = base + (pulse * 0.18 + audioPulse * 0.22 + energy * 0.2 + accent * 0.16);
      mesh.material.opacity = THREE.MathUtils.lerp(mesh.material.opacity, Math.min(0.85, target), 0.1);

      if (!mesh.userData || !mesh.userData.isGlow) {
        mesh.rotation.y = Math.sin(time * speed + index) * swing;
      } else {
        mesh.rotation.z = Math.sin(time * 0.4) * 0.05;
      }
    });

    if (starfield && starfield.material) {
      const base = starfield.userData && starfield.userData.baseOpacity ? starfield.userData.baseOpacity : 0.28;
      const target = base + (audioPulse * 0.18 + accent * 0.12);
      starfield.material.opacity = THREE.MathUtils.lerp(starfield.material.opacity, Math.min(0.8, target), 0.06);
      starfield.rotation.z += deltaSeconds * 0.08;
    }

    droneTrailMeshes.forEach((mesh) => {
      if (!mesh || !mesh.material) return;
      const base = mesh.userData && mesh.userData.baseOpacity ? mesh.userData.baseOpacity : 0.2;
      const offset = mesh.userData && mesh.userData.offset ? mesh.userData.offset : 0;
      const wave = mesh.userData && mesh.userData.wave ? mesh.userData.wave : 0.5;
      const osc = Math.sin(time * (1.4 + wave * 0.6) + offset) * 0.1;
      const target = base + osc + pulse * 0.18 + audioPulse * 0.24 + accent * 0.12;
      mesh.material.opacity = THREE.MathUtils.lerp(mesh.material.opacity, THREE.MathUtils.clamp(target, 0, 1), 0.12);
    });

    bridgeSearchLights.forEach((mesh, idx) => {
      if (!mesh || !mesh.material) return;
      mesh.rotation.y += deltaSeconds * (mesh.userData && mesh.userData.speed ? mesh.userData.speed : 0.6);
      const base = mesh.userData && mesh.userData.baseOpacity ? mesh.userData.baseOpacity : 0.18;
      const target = base + pulse * 0.24 + audioPulse * 0.3 + energy * 0.18 + accent * 0.15;
      mesh.material.opacity = THREE.MathUtils.lerp(mesh.material.opacity, Math.min(0.9, target), 0.18);
    });
  }

  // ============================================================================
  // AUDIO (OPTIONAL, NEVER BLOCKS)
  // ============================================================================

  function isAudioFile(file) {
    if (!file) return false;
    if (file.type && file.type.startsWith('audio/')) {
      return true;
    }
    const name = (file.name || '').toLowerCase();
    return ['.mp3', '.wav', '.aiff', '.aif', '.aac', '.ogg', '.flac', '.m4a', '.mp4']
      .some((ext) => name.endsWith(ext));
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return '';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.max(0, Math.round(seconds % 60)).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  function setupAudio(audioFile) {
    console.log(LOG_PREFIX, 'Setting up audio...');
    try {
      if (!isAudioFile(audioFile)) {
        showStatus('Dépose un fichier audio (MP3, WAV, AIFF...)', 2800);
        return;
      }

      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } else if (audioContext.state === 'suspended') {
        audioContext.resume().catch((err) => {
          console.warn(LOG_PREFIX, 'AudioContext resume failed:', err);
        });
      }

      if (audioSource) {
        try {
          audioSource.disconnect();
        } catch (disconnectErr) {
          console.warn(LOG_PREFIX, 'Audio source disconnect failed:', disconnectErr);
        }
        audioSource = null;
      }

      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
        audioElement.load();
      }

      if (audioObjectURL) {
        URL.revokeObjectURL(audioObjectURL);
        audioObjectURL = null;
      }

      audioElement = document.createElement('audio');
      audioElement.crossOrigin = 'anonymous';
      audioObjectURL = URL.createObjectURL(audioFile);
      audioElement.src = audioObjectURL;
      audioElement.loop = true;
      audioElement.playbackRate = playbackSpeed;
      audioElement.load();

      analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.7;
      audioData = new Uint8Array(analyser.frequencyBinCount);

      audioSource = audioContext.createMediaElementSource(audioElement);
      audioSource.connect(analyser);
      analyser.connect(audioContext.destination);

      audioElement.addEventListener('loadedmetadata', () => {
        const formatted = formatDuration(audioElement.duration);
        if (formatted) {
          showStatus(`Audio chargé · ${formatted}`, 2600);
        } else {
          showStatus('Audio chargé', 2200);
        }
        console.log(LOG_PREFIX, 'Audio duration:', audioElement.duration);
      }, { once: true });

      audioElement.addEventListener('error', (event) => {
        console.warn(LOG_PREFIX, 'Audio element error:', event);
        showStatus('Lecture audio impossible', 3000);
      });

      hasAudio = true;
      console.log(LOG_PREFIX, '✓ Audio ready');

      if (audioFilenameEl) {
        audioFilenameEl.textContent = audioFile.name || 'Custom track';
      }

      audioElement.currentTime = Math.max(0, Math.min(currentTime, audioElement.duration || currentTime));

      if (isPlaying) {
        audioElement.play().catch(err => {
          console.warn(LOG_PREFIX, 'Audio play failed:', err);
        });
      }
    } catch (err) {
      console.error(LOG_PREFIX, 'Audio setup failed:', err);
      showStatus('Audio failed: ' + err.message, 3000);
    }
  }

  // ============================================================================
  // RECORDING (25fps LOCKED)
  // ============================================================================

  function startRecording() {
    if (isRecording) return;
    console.log(LOG_PREFIX, 'Starting recording (25fps)...');

    try {
      const canvas = document.getElementById('canvas');
      const stream = canvas.captureStream(25);

      recordedChunks = [];

      const options = {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 10000000
      };

      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm;codecs=vp8';
      }

      mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;

        // Format: drone-night-clip-YYYY-MM-DD-HHmmss.webm
        const now = new Date();
        const timestamp = now.toISOString().replace(/:/g, '').replace(/\..+/, '').replace('T', '-');
        a.download = `drone-night-clip-${timestamp}.webm`;
        a.click();

        URL.revokeObjectURL(url);
        showStatus('✓ Recording saved', 3000);
        console.log(LOG_PREFIX, `✓ Recording saved: drone-night-clip-${timestamp}.webm`);
      };

      mediaRecorder.start(100);
      isRecording = true;

      // Restart from beginning
      currentTime = 0;
      isPlaying = true;
      syncPlayStateUI();
      if (audioElement) {
        audioElement.currentTime = 0;
        audioElement.playbackRate = playbackSpeed;
        audioElement.play().catch(e => console.warn(LOG_PREFIX, 'Audio play error:', e));
      }

      tempoState.beatIndex = 0;
      tempoState.lastBeatTime = 0;
      tempoState.nextBeatTime = tempoState.beatDuration;
      tempoState.audioPulse = 0;
      tempoState.energy = 0;

      showStatus('Enregistrement 1080×1920 @25fps', 0); // 0 = don't hide

      console.log(LOG_PREFIX, '✓ Recording started');
    } catch (err) {
      console.error(LOG_PREFIX, 'Recording failed:', err);
      showStatus('Recording failed: ' + err.message, 5000);
    }
  }

  function stopRecording() {
    if (!isRecording) return;
    console.log(LOG_PREFIX, 'Stopping recording...');

    try {
      mediaRecorder.stop();
      isRecording = false;
      hideStatus();
    } catch (err) {
      console.error(LOG_PREFIX, 'Stop recording error:', err);
    }
  }

  // ============================================================================
  // RENDER LOOP (ALWAYS RUNNING, NEVER CRASHES)
  // ============================================================================

  function sampleAudioEnergy() {
    if (hasAudio && analyser && audioData) {
      try {
        analyser.getByteFrequencyData(audioData);
        const bassBins = Math.max(4, Math.floor(audioData.length * 0.22));
        let bassSum = 0;
        for (let i = 0; i < bassBins; i++) {
          bassSum += audioData[i];
        }
        const normalized = bassBins > 0 ? bassSum / (bassBins * 255) : 0;
        lastAudioEnergy = Math.min(1, normalized * 1.4);
      } catch (err) {
        console.warn(LOG_PREFIX, 'Audio analysis failed:', err);
      }
    } else {
      const beatDuration = tempoState.beatDuration > 0 ? tempoState.beatDuration : 60 / DEFAULT_BPM;
      const beatPhase = ((currentTime / beatDuration) % 1);
      const beatPulse = Math.pow(Math.sin(beatPhase * Math.PI), 2);
      const barDuration = tempoState.barDuration > 0 ? tempoState.barDuration : beatDuration * 4;
      const barPhase = ((currentTime / barDuration) % 1);
      lastAudioEnergy = 0.18 + beatPulse * 0.6 + Math.pow(Math.sin(barPhase * Math.PI), 2) * 0.25;
    }

    return lastAudioEnergy;
  }

  function updateTempoState() {
    const beatDuration = tempoState.beatDuration > 0 ? tempoState.beatDuration : 60 / DEFAULT_BPM;
    const barDuration = tempoState.barDuration > 0 ? tempoState.barDuration : beatDuration * 4;
    const beats = sceneData && Array.isArray(sceneData.beats) ? sceneData.beats : null;

    if (currentTime + 0.0001 < tempoState.lastBeatTime) {
      tempoState.beatIndex = 0;
      tempoState.lastBeatTime = 0;
      tempoState.nextBeatTime = beatDuration;
    }

    if (beats && beats.length > 0) {
      while (tempoState.beatIndex < beats.length && currentTime >= beats[tempoState.beatIndex]) {
        tempoState.lastBeatTime = beats[tempoState.beatIndex];
        tempoState.beatIndex += 1;
      }
      const nextIndex = Math.min(tempoState.beatIndex, beats.length - 1);
      tempoState.nextBeatTime = beats[nextIndex] > tempoState.lastBeatTime
        ? beats[nextIndex]
        : tempoState.lastBeatTime + beatDuration;
    } else {
      if (currentTime >= tempoState.nextBeatTime) {
        const steps = Math.max(1, Math.round((currentTime - tempoState.nextBeatTime) / beatDuration) + 1);
        tempoState.lastBeatTime = tempoState.nextBeatTime;
        tempoState.nextBeatTime = tempoState.lastBeatTime + beatDuration * steps;
      }
    }

    const span = Math.max(beatDuration, tempoState.nextBeatTime - tempoState.lastBeatTime);
    const beatProgress = span > 0 ? (currentTime - tempoState.lastBeatTime) / span : 0;
    const clamped = Math.max(0, Math.min(1, beatProgress));

    const beatPulse = Math.pow(Math.sin(clamped * Math.PI), 2);
    tempoState.beatPulse = beatPulse;

    const audioPulseTarget = Math.max(0, (lastAudioEnergy - 0.22) * 1.35);
    tempoState.audioPulse = THREE.MathUtils.lerp(tempoState.audioPulse, audioPulseTarget, 0.25);

    const combinedPulse = Math.min(1, beatPulse * 0.6 + tempoState.audioPulse * 0.7);
    tempoState.pulse = combinedPulse;

    tempoState.wave = Math.sin(clamped * Math.PI * 2) * (0.6 + tempoState.audioPulse * 0.4);

    const barPhase = (currentTime / barDuration) % 1;
    tempoState.barPulse = Math.pow(Math.sin(barPhase * Math.PI), 2);

    const beatAccent = Math.max(0, 1 - clamped * 8);
    const audioAccent = Math.max(0, (tempoState.audioPulse - 0.45) * 1.6);
    tempoState.accent = Math.min(1, Math.max(beatAccent, audioAccent));

    const previousEnergy = tempoState.energy;
    tempoState.energy = THREE.MathUtils.lerp(tempoState.energy, lastAudioEnergy, 0.3);

    if (hasAudio && isPlaying) {
      const energyDelta = lastAudioEnergy - previousEnergy;
      if (lastAudioEnergy > 0.55 && energyDelta > 0.08) {
        const now = currentTime;
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

  function render(timestamp) {
    requestAnimationFrame(render);

    try {
      const delta = timestamp - lastFrameTime;
      lastFrameTime = timestamp;

      fps = Math.round(1000 / Math.max(delta, 1));

      if (isPlaying) {
        if (isRecording) {
          currentTime += 1 / 25 * playbackSpeed;
        } else {
          currentTime += (delta / 1000) * playbackSpeed;
        }

        // Check duration safely
        const duration = (sceneData && sceneData.meta) ? sceneData.meta.duration : TARGET_DURATION;
        if (currentTime >= duration) {
          if (isRecording) {
            stopRecording();
            isPlaying = false;
            syncPlayStateUI();
          } else {
            currentTime = 0;
          }
        }

        // Sync audio if available
        if (audioElement && hasAudio) {
          try {
            const audioDiff = Math.abs(audioElement.currentTime - currentTime);
            if (audioDiff > 0.1) {
              audioElement.currentTime = currentTime;
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

      if (composer) {
        composer.render();
      } else if (renderer) {
        renderer.render(scene, camera);
      }

      updateHUD();
      updateTimeline();

    } catch (err) {
      console.error(LOG_PREFIX, 'Render error:', err);
      // Don't crash, just continue next frame
    }
  }

  function updateHUD() {
    try {
      document.getElementById('hud-time').textContent = currentTime.toFixed(2) + 's';
      document.getElementById('hud-shot').textContent = currentShot ? currentShot.name : '-';
      document.getElementById('hud-fps').textContent = fps;
      document.getElementById('hud-speed').textContent = playbackSpeed.toFixed(1) + 'x';
    } catch (err) {
      // Silently fail if HUD elements missing
    }
  }

  // ============================================================================
  // UI SETUP (ALWAYS RUNS)
  // ============================================================================

  function setupUI() {
    console.log(LOG_PREFIX, 'Setting up UI...');

    controlDeckEl = document.getElementById('control-deck');
    playPauseBtn = document.getElementById('btn-playpause');
    playbackProgressEl = document.getElementById('playback-progress');
    modePillEl = document.getElementById('mode-pill');
    audioFilenameEl = document.getElementById('audio-filename');
    presetLabelEl = document.getElementById('preset-label');
    const audioInputMain = document.getElementById('input-audio-main');
    const audioChip = document.getElementById('audio-chip');
    const dropOverlay = document.getElementById('drop-overlay');

    if (audioFilenameEl) {
      audioFilenameEl.textContent = 'No track';
    }
    if (presetLabelEl) {
      presetLabelEl.textContent = 'Default';
    }

    const handleAudioFile = (file) => {
      if (!file) return;
      if (dropOverlay) {
        dropOverlay.classList.remove('visible');
        dropOverlay.setAttribute('aria-hidden', 'true');
      }
      setupAudio(file);
    };

    // Start button (splash screen)
    const btnStart = document.getElementById('btn-start');
    if (btnStart) {
      btnStart.addEventListener('click', () => {
        console.log(LOG_PREFIX, 'Start button clicked');

        // Resume AudioContext if needed (user gesture requirement)
        if (audioContext && audioContext.state === 'suspended') {
          audioContext.resume().then(() => {
            console.log(LOG_PREFIX, 'AudioContext resumed');
          }).catch(err => {
            console.warn(LOG_PREFIX, 'AudioContext resume failed:', err);
          });
        }

        // Hide splash
        document.getElementById('splash').classList.add('hidden');

        // Start playing and recording
        isPlaying = true;
        startRecording(); // Auto-start recording
        syncPlayStateUI();
        console.log(LOG_PREFIX, 'Playback and recording started');
      });
    }

    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', () => {
        if (!isInitialized) return;

        isPlaying = !isPlaying;
        if (isPlaying) {
          if (audioElement) {
            audioElement.playbackRate = playbackSpeed;
            audioElement.play().catch(err => {
              console.warn(LOG_PREFIX, 'Audio play error:', err);
            });
          }
        } else if (audioElement) {
          audioElement.pause();
        }

        syncPlayStateUI();
        console.log(LOG_PREFIX, isPlaying ? 'Playing' : 'Paused');
      });
    }

    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        currentTime = 0;
        if (audioElement) {
          audioElement.currentTime = 0;
          audioElement.playbackRate = playbackSpeed;
        }
        tempoState.beatIndex = 0;
        tempoState.lastBeatTime = 0;
        tempoState.nextBeatTime = tempoState.beatDuration;
        tempoState.audioPulse = 0;
        tempoState.energy = 0;
        updateTimeline();
        showStatus('↺ Rewound to start', 1400);
        console.log(LOG_PREFIX, 'Timeline reset');
      });
    }

    // Audio file input (splash)
    const audioInputSplash = document.getElementById('input-audio-splash');
    if (audioInputSplash) {
      audioInputSplash.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          handleAudioFile(file);
        }
        e.target.value = '';
      });
    }

    if (audioInputMain) {
      audioInputMain.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          handleAudioFile(file);
        }
        e.target.value = '';
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

    bpmInputEl = document.getElementById('input-bpm');
    if (bpmInputEl) {
      bpmInputEl.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        if (!sceneData || !Number.isFinite(value) || value < 40) {
          return;
        }
        sceneData.meta.bpm = value;
        tempoState.bpm = value;
        tempoState.beatDuration = 60 / value;
        tempoState.barDuration = tempoState.beatDuration * 4;
        tempoState.beatIndex = 0;
        tempoState.lastBeatTime = 0;
        tempoState.nextBeatTime = tempoState.beatDuration;
        tempoState.audioPulse = 0;
        tempoState.energy = 0;
        regenerateBeats(sceneData);
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
              currentTime = 0;
              if (audioElement) audioElement.currentTime = 0;
              console.log(LOG_PREFIX, '✓ Insane preset loaded');
            } else {
              throw new Error(`HTTP ${response.status}`);
            }
          } catch (err) {
            console.warn(LOG_PREFIX, 'Failed to load insane preset, falling back to default:', err.message);
            showStatus('⚠ Preset indisponible, retour au mode principal', 3000);
            await loadSceneDataAsync();
            applySceneData(sceneData);
            currentTime = 0;
            if (audioElement) audioElement.currentTime = 0;
          }
        } else {
          await loadSceneDataAsync();
          applySceneData(sceneData, '✓ Mode principal chargé');
          currentTime = 0;
          if (audioElement) audioElement.currentTime = 0;
        }

        if (audioElement && isPlaying) {
          audioElement.play().catch(err => {
            console.warn(LOG_PREFIX, 'Audio play error:', err);
          });
        }

        syncPlayStateUI();
      });
    }

    window.addEventListener('resize', onResize);

    console.log(LOG_PREFIX, '✓ UI setup complete');
  }

  function setupKeyboard() {
    console.log(LOG_PREFIX, 'Setting up keyboard...');

    window.addEventListener('keydown', (e) => {
      switch(e.key) {
        case ' ':
          e.preventDefault();
          // Toggle play
          if (document.getElementById('splash').classList.contains('hidden')) {
            isPlaying = !isPlaying;
            if (isPlaying && audioElement) {
              audioElement.playbackRate = playbackSpeed;
              audioElement.play().catch(err => {
                console.warn(LOG_PREFIX, 'Audio play error:', err);
              });
            } else if (!isPlaying && audioElement) {
              audioElement.pause();
            }
            syncPlayStateUI();
            console.log(LOG_PREFIX, isPlaying ? 'Playing' : 'Paused');
          }
          break;

        case 'h':
        case 'H':
          hudVisible = !hudVisible;
          const hud = document.getElementById('hud');
          if (hud) {
            if (hudVisible) hud.classList.add('visible');
            else hud.classList.remove('visible');
          }
          console.log(LOG_PREFIX, 'HUD:', hudVisible ? 'visible' : 'hidden');
          break;

        case ',':
          playbackSpeed = Math.max(0.5, playbackSpeed - 0.25);
          if (audioElement) {
            audioElement.playbackRate = playbackSpeed;
          }
          console.log(LOG_PREFIX, 'Speed:', playbackSpeed);
          break;

        case '.':
          playbackSpeed = Math.min(2.0, playbackSpeed + 0.25);
          if (audioElement) {
            audioElement.playbackRate = playbackSpeed;
          }
          console.log(LOG_PREFIX, 'Speed:', playbackSpeed);
          break;

        case 'r':
        case 'R':
          currentTime = 0;
          if (audioElement) {
            audioElement.currentTime = 0;
            audioElement.playbackRate = playbackSpeed;
          }
          console.log(LOG_PREFIX, 'Restarted');
          updateTimeline();
          break;

        case 's':
        case 'S':
          // Screenshot (bonus)
          if (e.shiftKey) {
            takeScreenshot();
          }
          break;
      }
    });

    console.log(LOG_PREFIX, '✓ Keyboard setup complete');
  }

  function onResize() {
    try {
      const wrapper = document.getElementById('canvas-wrapper');
      const width = wrapper.clientWidth;
      const height = wrapper.clientHeight;
      const aspect = height > 0 ? width / height : TARGET_ASPECT;

      camera.aspect = aspect;
      camera.updateProjectionMatrix();

      if (renderer && renderer.domElement) {
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
      }
    } catch (err) {
      console.error(LOG_PREFIX, 'Resize error:', err);
    }
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  function seededRandom(seed) {
    let s = seed;
    return function() {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  function applyEasing(t, easing) {
    switch ((easing || '').toLowerCase()) {
      case 'easein':
        return t * t;
      case 'easeout':
        return 1 - Math.pow(1 - t, 2);
      case 'easeinout':
      case 'smooth':
        return t * t * (3 - 2 * t);
      case 'fastin':
        return Math.pow(t, 1.5);
      case 'fastout':
        return 1 - Math.pow(1 - t, 1.5);
      case 'linear':
      default:
        return t;
    }
  }

  function showStatus(message, duration) {
    const statusEl = document.getElementById('status');
    const statusText = document.getElementById('status-text');
    if (statusEl && statusText) {
      statusText.textContent = message;
      statusEl.classList.add('visible');

      if (duration > 0) {
        setTimeout(() => {
          statusEl.classList.remove('visible');
        }, duration);
      }
    }
  }

  function hideStatus() {
    const statusEl = document.getElementById('status');
    if (statusEl) {
      statusEl.classList.remove('visible');
    }
  }

  function takeScreenshot() {
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

  function updateTimeline() {
    if (!playbackProgressEl) return;

    const duration = (sceneData && sceneData.meta && sceneData.meta.duration) || TARGET_DURATION;
    const progress = duration > 0 ? Math.min(Math.max(currentTime / duration, 0), 1) : 0;
    playbackProgressEl.style.width = `${(progress * 100).toFixed(2)}%`;
  }

  function refreshPresetUI(data) {
    const title = data && data.meta && data.meta.title ? data.meta.title : 'Default';

    if (presetLabelEl) {
      presetLabelEl.textContent = title;
    }

    if (modePillEl) {
      const base = title.toUpperCase();
      const label = base.includes('MODE') ? base : `${base} MODE`;
      modePillEl.textContent = label.length > 26 ? `${label.slice(0, 26)}…` : label;
    }

    if (bpmInputEl && data && data.meta && data.meta.bpm) {
      bpmInputEl.value = Math.round(data.meta.bpm);
    }
  }

  function syncPlayStateUI() {
    if (playPauseBtn) {
      playPauseBtn.textContent = isPlaying ? 'Pause' : 'Play';
    }
  }

  // ============================================================================
  // START (ALWAYS RUNS, NEVER FAILS)
  // ============================================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log(LOG_PREFIX, 'DOM ready');
      setTimeout(init, 100);
    });
  } else {
    console.log(LOG_PREFIX, 'DOM already ready');
    setTimeout(init, 100);
  }

  // Global error handler (last resort)
  window.addEventListener('error', (e) => {
    console.error(LOG_PREFIX, 'Global error:', e.error);
    // Don't crash, just log
  });

  console.log(LOG_PREFIX, 'Script loaded');

})();

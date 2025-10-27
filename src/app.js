/**
 * Drone Night POV V2 - Anti-Fragile B&W Edition
 * NEVER blocks on fetch, audio, or any async operation
 * Works in file://, with missing JSON, without audio
 */

(function() {
  'use strict';

  const LOG_PREFIX = '[DRONE]';

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
      sceneData = await response.json();
      console.log(LOG_PREFIX, '✓ Loaded scene.json');
    } catch (err) {
      console.warn(LOG_PREFIX, 'Failed to fetch scene.json:', err.message);
      // Fallback to inline scene
      sceneData = loadInlineScene();
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
      meta: { title: "Emergency Scene", duration: 18, bpm: 90, seed: 42 },
      beats: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18],
      shots: [
        {
          name: "Flight",
          time: [0, 18],
          path: {
            type: "catmullrom",
            points: [[-20, 15, 50], [0, 15, 30], [20, 10, 10], [30, 10, 0]]
          },
          camera: { fov: [60, 70], rollDeg: [0, 2], speedMul: 1.0 },
          fx: { bloom: [0.1, 0.15], vignette: [0.3, 0.5], neonPulse: 0.1 }
        }
      ]
    };
  }

  function finishInit() {
    console.log(LOG_PREFIX, 'Finishing init...');

    try {
      // Build city and bridge (uses sceneData.meta.seed if available)
      const seed = sceneData ? (sceneData.meta.seed || 42) : 42;
      console.log(LOG_PREFIX, 'Setting up city with seed:', seed);
      setupCity(seed);
      console.log(LOG_PREFIX, '✓ City setup complete');

      console.log(LOG_PREFIX, 'Setting up bridge...');
      setupBridge();
      console.log(LOG_PREFIX, '✓ Bridge setup complete');

      console.log(LOG_PREFIX, 'Setting up post-processing...');
      setupPostProcessing();
      console.log(LOG_PREFIX, '✓ Post-processing setup complete');

      // Start render loop (ALWAYS, even if scene data is missing)
      lastFrameTime = performance.now();
      requestAnimationFrame(render);
      console.log(LOG_PREFIX, '✓ Render loop started');

      // Mark as initialized
      isInitialized = true;

      // Show UI controls after a brief moment
      setTimeout(() => {
        console.log(LOG_PREFIX, 'Showing UI controls...');
        const spinner = document.getElementById('init-spinner');
        const status = document.getElementById('init-status');
        const buttons = document.getElementById('splash-buttons');
        const controls = document.getElementById('splash-controls');

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
      }, 500);

      console.log(LOG_PREFIX, '✓ Initialization complete, render loop started');
    } catch (error) {
      console.error(LOG_PREFIX, 'ERROR in finishInit():', error);
      console.error(LOG_PREFIX, 'Error stack:', error.stack);

      // Try to show error to user
      const status = document.getElementById('init-status');
      if (status) {
        status.textContent = 'Init error: ' + error.message;
        status.className = 'error';
      }

      // Still try to show start button
      setTimeout(() => {
        const spinner = document.getElementById('init-spinner');
        const buttons = document.getElementById('splash-buttons');
        if (spinner) spinner.classList.add('hidden');
        if (buttons) buttons.style.display = 'flex';
      }, 500);
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
    const wrapper = document.getElementById('canvas-wrapper');
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;

    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true
    });

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0; // Lower for B&W
    console.log(LOG_PREFIX, 'Renderer setup');
  }

  function setupScene() {
    scene = new THREE.Scene();
    // Black & white palette
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, 0.015);
    console.log(LOG_PREFIX, 'Scene setup (B&W mode)');
  }

  function setupCamera() {
    const wrapper = document.getElementById('canvas-wrapper');
    const aspect = wrapper.clientWidth / wrapper.clientHeight;

    camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 300);
    camera.position.set(0, 20, 50);
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

    const gridSize = 20;
    const blockSize = 8;
    let buildingCount = 0;

    for (let x = -gridSize; x < gridSize; x += blockSize) {
      for (let z = -gridSize; z < gridSize; z += blockSize) {
        // Skip camera path
        if (x > -10 && x < 15 && z > 0 && z < 60) continue;

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
            side: THREE.DoubleSide
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

              cityGroup.add(window);
            }
          }

          // Rooftop accents (subtle white/gray)
          if (rng() > 0.85) {
            const accentColor = new THREE.Color(0.9, 0.9, 0.9);
            const accentMat = new THREE.MeshBasicMaterial({
              color: accentColor,
              transparent: true,
              opacity: 0.7
            });
            const accent = new THREE.Mesh(
              new THREE.BoxGeometry(width * 0.8, 0.2, depth * 0.8),
              accentMat
            );
            accent.position.set(bx, height + 0.1, bz);
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

    console.log(LOG_PREFIX, `City generated: ${buildingCount} buildings (B&W)`);
  }

  // ============================================================================
  // BRIDGE SETUP (B&W)
  // ============================================================================

  function setupBridge() {
    bridgeGroup = new THREE.Group();
    scene.add(bridgeGroup);

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
    bridgeGroup.add(underlight);

    console.log(LOG_PREFIX, 'Bridge created (B&W)');
  }

  // ============================================================================
  // POST-PROCESSING (B&W OPTIMIZED)
  // ============================================================================

  function setupPostProcessing() {
    const wrapper = document.getElementById('canvas-wrapper');
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;

    composer = new THREE.EffectComposer(renderer);

    const renderPass = new THREE.RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Subtle bloom (monochrome, avoid "milky" look)
    bloomPass = new THREE.UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.3,  // Low strength for B&W
      0.6,  // Radius
      0.90  // High threshold
    );
    composer.addPass(bloomPass);

    // Vignette + Grain shader (B&W only)
    // Create ShaderMaterial directly to avoid UniformsUtils dependency
    const bwMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uVignette: { value: 0.4 },
        uGrain: { value: 0.12 },
        uTime: { value: 0 }
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
        varying vec2 vUv;

        float random(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        float filmGrain(vec2 uv, float time) {
          vec2 uvRandom = uv;
          uvRandom.y *= random(vec2(uvRandom.y, time));
          return random(uvRandom);
        }

        void main() {
          vec4 color = texture2D(tDiffuse, vUv);

          // Force monochrome (luminance)
          float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
          color.rgb = vec3(luma);

          // Strong vignette
          vec2 uv = vUv * 2.0 - 1.0;
          float dist = length(uv);
          float vignette = smoothstep(0.9, 0.2, dist * uVignette * 3.5);
          color.rgb *= vignette;

          // Film grain
          float grain = filmGrain(vUv * 3.0, uTime * 10.0) * uGrain;
          color.rgb += grain - uGrain * 0.5;

          // Contrast boost for B&W
          color.rgb = (color.rgb - 0.5) * 1.2 + 0.5;
          color.rgb = clamp(color.rgb, 0.0, 1.0);

          gl_FragColor = color;
        }
      `
    });

    vignettePass = new THREE.ShaderPass(bwMaterial);
    vignettePass.renderToScreen = true;
    composer.addPass(vignettePass);

    console.log(LOG_PREFIX, 'Post-processing setup (B&W optimized)');
  }

  // ============================================================================
  // CAMERA PATH & ANIMATION (SAFE, CHECKS sceneData)
  // ============================================================================

  function updateCameraPath() {
    // Safety check: do nothing if no scene data
    if (!sceneData || !sceneData.shots || !Array.isArray(sceneData.shots) || sceneData.shots.length === 0) {
      // Just keep camera at default position
      return;
    }

    // Find current shot
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

    // Build curve if changed
    if (currentShot !== shot) {
      currentShot = shot;
      try {
        const points = shot.path.points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
        cameraCurve = new THREE.CatmullRomCurve3(points);
      } catch (err) {
        console.error(LOG_PREFIX, 'Failed to build camera curve:', err);
        return;
      }
    }

    if (!cameraCurve) return;

    // Interpolate along shot
    const shotDuration = shot.time[1] - shot.time[0];
    const shotProgress = (currentTime - shot.time[0]) / shotDuration;
    const t = Math.max(0, Math.min(1, shotProgress));

    try {
      // Get position on curve
      const pos = cameraCurve.getPoint(t);
      camera.position.copy(pos);

      // Micro-oscillation
      const oscillation = shot.camera.oscillation || 0;
      if (oscillation > 0) {
        cameraOscillationPhase += 0.08;
        camera.position.x += Math.sin(cameraOscillationPhase * 2.3) * oscillation * 0.3;
        camera.position.y += Math.sin(cameraOscillationPhase * 3.1) * oscillation * 0.2;
        camera.position.z += Math.sin(cameraOscillationPhase * 1.7) * oscillation * 0.15;
      }

      // Look ahead
      const lookAheadT = Math.min(1, t + 0.05);
      const lookAt = cameraCurve.getPoint(lookAheadT);
      camera.lookAt(lookAt);

      // FOV
      const fov = THREE.MathUtils.lerp(shot.camera.fov[0], shot.camera.fov[1], t);
      camera.fov = fov;
      camera.updateProjectionMatrix();

      // Roll + beat jitter
      const baseRoll = THREE.MathUtils.lerp(
        shot.camera.rollDeg[0] * Math.PI / 180,
        shot.camera.rollDeg[1] * Math.PI / 180,
        t
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

      camera.rotation.z = baseRoll + beatJitter;

      // Update FX
      updateFX(shot, t);

      // Fade
      if (shot.fx.fade) {
        const [fadeStart, fadeEnd] = shot.fx.fade;
        if (currentTime >= fadeStart) {
          const fadeT = (currentTime - fadeStart) / (fadeEnd - fadeStart);
          const opacity = 1 - Math.min(1, fadeT);
          renderer.toneMappingExposure = 1.0 * opacity;
        }
      } else {
        renderer.toneMappingExposure = 1.0;
      }

    } catch (err) {
      console.error(LOG_PREFIX, 'Camera update error:', err);
    }
  }

  function updateFX(shot, t) {
    // Audio reactivity (optional)
    let audioEnergy = 0;
    if (hasAudio && analyser && audioData) {
      try {
        analyser.getByteFrequencyData(audioData);
        const bassData = audioData.slice(0, Math.floor(audioData.length * 0.1));
        const sum = bassData.reduce((a, b) => a + b, 0);
        audioEnergy = sum / (bassData.length * 255);
      } catch (err) {
        console.warn(LOG_PREFIX, 'Audio analysis failed:', err);
      }
    } else {
      // Fake beat energy
      if (sceneData && sceneData.beats && Array.isArray(sceneData.beats)) {
        const nearestBeat = sceneData.beats.reduce((prev, curr) =>
          Math.abs(curr - currentTime) < Math.abs(prev - currentTime) ? curr : prev
        );
        const beatDist = Math.abs(nearestBeat - currentTime);
        audioEnergy = beatDist < 0.1 ? Math.pow(1 - beatDist / 0.1, 2) : 0.1;
      }
    }

    // Bloom (subtle for B&W)
    if (shot.fx && shot.fx.bloom && bloomPass) {
      const bloomBase = THREE.MathUtils.lerp(shot.fx.bloom[0], shot.fx.bloom[1], t);
      const bloomPulse = (shot.fx.neonPulse || 0) * audioEnergy;
      bloomPass.strength = bloomBase + bloomPulse;
    }

    // Vignette + grain
    if (shot.fx && shot.fx.vignette && vignettePass && vignettePass.uniforms) {
      const vignetteVal = THREE.MathUtils.lerp(shot.fx.vignette[0], shot.fx.vignette[1], t);
      vignettePass.uniforms.uVignette.value = vignetteVal;
      vignettePass.uniforms.uTime.value = currentTime;
      vignettePass.uniforms.uGrain.value = 0.12 + audioEnergy * 0.05;
    }
  }

  // ============================================================================
  // AUDIO (OPTIONAL, NEVER BLOCKS)
  // ============================================================================

  function setupAudio(audioFile) {
    console.log(LOG_PREFIX, 'Setting up audio...');
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      if (audioElement) {
        audioElement.pause();
        audioElement.remove();
      }

      audioElement = document.createElement('audio');
      audioElement.src = URL.createObjectURL(audioFile);
      audioElement.loop = false;

      analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.7;
      audioData = new Uint8Array(analyser.frequencyBinCount);

      audioSource = audioContext.createMediaElementSource(audioElement);
      audioSource.connect(analyser);
      analyser.connect(audioContext.destination);

      hasAudio = true;
      showStatus('Audio loaded', 2000);
      console.log(LOG_PREFIX, '✓ Audio ready');

      if (isPlaying) {
        audioElement.currentTime = currentTime;
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
      if (audioElement) {
        audioElement.currentTime = 0;
        audioElement.play().catch(e => console.warn(LOG_PREFIX, 'Audio play error:', e));
      }

      showStatus('Recording...', 0); // 0 = don't hide

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
        const duration = (sceneData && sceneData.meta) ? sceneData.meta.duration : 18;
        if (currentTime >= duration) {
          if (isRecording) {
            stopRecording();
            isPlaying = false;
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

      updateCameraPath();

      if (composer) {
        composer.render();
      } else if (renderer) {
        renderer.render(scene, camera);
      }

      updateHUD();

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
        console.log(LOG_PREFIX, 'Playback and recording started');
      });
    }

    // Audio file input (splash)
    const audioInputSplash = document.getElementById('input-audio-splash');
    if (audioInputSplash) {
      audioInputSplash.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          setupAudio(file);
        }
      });
    }

    // Preset selector
    const presetSelect = document.getElementById('preset-select');
    if (presetSelect) {
      presetSelect.addEventListener('change', async (e) => {
        const preset = e.target.value;
        if (preset === 'insane') {
          // Load insane preset with timeout
          console.log(LOG_PREFIX, 'Loading insane preset...');
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const response = await fetch('presets/insane.json', { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
              sceneData = await response.json();
              currentTime = 0;
              currentShot = null;
              showStatus('✓ Insane preset loaded', 2000);
              console.log(LOG_PREFIX, '✓ Insane preset loaded');
            } else {
              throw new Error(`HTTP ${response.status}`);
            }
          } catch (err) {
            console.warn(LOG_PREFIX, 'Failed to load insane preset, falling back to default:', err.message);
            showStatus('⚠ Preset unavailable, using default', 3000);
            // Fallback to default
            await loadSceneDataAsync();
            currentTime = 0;
            currentShot = null;
          }
        } else {
          // Load default
          await loadSceneDataAsync();
          currentTime = 0;
          currentShot = null;
          showStatus('✓ Default scene loaded', 2000);
        }
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
              audioElement.play().catch(err => {
                console.warn(LOG_PREFIX, 'Audio play error:', err);
              });
            } else if (!isPlaying && audioElement) {
              audioElement.pause();
            }
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
          console.log(LOG_PREFIX, 'Speed:', playbackSpeed);
          break;

        case '.':
          playbackSpeed = Math.min(2.0, playbackSpeed + 0.25);
          console.log(LOG_PREFIX, 'Speed:', playbackSpeed);
          break;

        case 'r':
        case 'R':
          currentTime = 0;
          if (audioElement) audioElement.currentTime = 0;
          console.log(LOG_PREFIX, 'Restarted');
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

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
      if (composer) composer.setSize(width, height);
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

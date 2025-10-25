/**
 * Drone Night POV - Three.js Main Application
 * Procedural night city with camera path animation, audio-reactive FX, and 25fps recording
 */

(function() {
  'use strict';

  // ============================================================================
  // GLOBAL STATE
  // ============================================================================

  let scene, camera, renderer, composer;
  let sceneData = null;
  let currentTime = 0;
  let isPlaying = false;
  let playbackSpeed = 1.0;
  let hudVisible = false;
  let lastFrameTime = 0;
  let fps = 60;

  // Camera path
  let cameraCurve = null;
  let currentShot = null;

  // Audio
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
  let recordingStartTime = 0;

  // City objects (reusable)
  let cityGroup = null;
  let bridgeGroup = null;

  // Post-processing
  let bloomPass = null;
  let vignettePass = null;
  let grainPass = null;

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async function init() {
    const canvas = document.getElementById('canvas');
    const loading = document.getElementById('loading');

    // Check WebGL support
    if (!isWebGLAvailable()) {
      console.warn('WebGL not available, using 2D fallback');
      loading.innerHTML = '<div>WebGL not supported, using 2D fallback...</div>';
      if (window.initFallback2D) {
        setTimeout(() => window.initFallback2D(), 100);
      }
      return;
    }

    try {
      // Load scene configuration
      sceneData = await loadJSON('scene.json');
      console.log('Scene loaded:', sceneData.meta.title);

      // Setup Three.js
      setupRenderer(canvas);
      setupScene();
      setupCamera();
      setupLights();
      setupCity();
      setupBridge();
      setupPostProcessing();

      // Setup UI
      setupUI();
      setupKeyboard();

      // Hide loading
      loading.classList.add('hidden');

      // Start render loop
      requestAnimationFrame(render);

      console.log('✓ Initialization complete');
    } catch (error) {
      console.error('Initialization failed:', error);
      loading.innerHTML = `<div style="color: #ff3333;">Error: ${error.message}</div>`;
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
      preserveDrawingBuffer: true // Required for recording
    });

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
  }

  function setupScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000510);
    scene.fog = new THREE.FogExp2(0x000510, 0.015);
  }

  function setupCamera() {
    const wrapper = document.getElementById('canvas-wrapper');
    const aspect = wrapper.clientWidth / wrapper.clientHeight;

    camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 300);
    camera.position.set(0, 20, 50);
    camera.lookAt(0, 0, 0);
  }

  function setupLights() {
    // Ambient light (very subtle)
    const ambient = new THREE.AmbientLight(0x0a0a15, 0.3);
    scene.add(ambient);

    // Directional light (moonlight)
    const moon = new THREE.DirectionalLight(0x4466aa, 0.4);
    moon.position.set(50, 100, 50);
    scene.add(moon);

    // Hemisphere light for better gradation
    const hemi = new THREE.HemisphereLight(0x0a0a20, 0x000510, 0.5);
    scene.add(hemi);
  }

  // ============================================================================
  // PROCEDURAL CITY GENERATION
  // ============================================================================

  function setupCity() {
    cityGroup = new THREE.Group();
    scene.add(cityGroup);

    const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
    const windowGeo = new THREE.PlaneGeometry(0.3, 0.4);

    // Seed for deterministic randomness
    const seed = sceneData.meta.seed || 42;
    let rng = seededRandom(seed);

    // Create city blocks in a grid
    const gridSize = 20;
    const blockSize = 8;

    for (let x = -gridSize; x < gridSize; x += blockSize) {
      for (let z = -gridSize; z < gridSize; z += blockSize) {
        // Skip area where camera path goes
        if (x > -10 && x < 15 && z > 0 && z < 60) continue;

        const buildingCount = Math.floor(rng() * 3) + 1;

        for (let i = 0; i < buildingCount; i++) {
          const bx = x + (rng() - 0.5) * blockSize * 0.8;
          const bz = z + (rng() - 0.5) * blockSize * 0.8;
          const width = 2 + rng() * 3;
          const depth = 2 + rng() * 3;
          const height = 5 + rng() * 25;

          // Building body
          const buildingMat = new THREE.MeshLambertMaterial({
            color: new THREE.Color(0.02, 0.02, 0.04),
            flatShading: true
          });

          const building = new THREE.Mesh(buildingGeo, buildingMat);
          building.scale.set(width, height, depth);
          building.position.set(bx, height / 2, bz);
          cityGroup.add(building);

          // Windows (instanced)
          const windowCount = Math.floor(height / 2) * 4;
          const windowMat = new THREE.MeshBasicMaterial({
            color: rng() > 0.3 ? 0xffaa44 : 0x00ffff,
            side: THREE.DoubleSide
          });

          for (let w = 0; w < windowCount; w++) {
            if (rng() > 0.4) { // 40% windows are lit
              const window = new THREE.Mesh(windowGeo, windowMat.clone());
              const side = Math.floor(rng() * 4);
              const wy = 2 + (rng() * (height - 4));

              // Position on building face
              if (side === 0) window.position.set(bx + width/2, wy, bz);
              else if (side === 1) window.position.set(bx - width/2, wy, bz);
              else if (side === 2) window.position.set(bx, wy, bz + depth/2);
              else window.position.set(bx, wy, bz - depth/2);

              if (side < 2) window.rotation.y = Math.PI / 2;

              cityGroup.add(window);
            }
          }

          // Random neon accent on some buildings
          if (rng() > 0.85) {
            const neonColor = rng() > 0.5 ? 0x00ffff : 0xff6600;
            const neonMat = new THREE.MeshBasicMaterial({ color: neonColor });
            const neon = new THREE.Mesh(
              new THREE.BoxGeometry(width * 0.8, 0.3, depth * 0.8),
              neonMat
            );
            neon.position.set(bx, height + 0.2, bz);
            cityGroup.add(neon);
          }
        }
      }
    }

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshLambertMaterial({
      color: 0x0a0a0f,
      side: THREE.DoubleSide
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    cityGroup.add(ground);

    console.log('✓ City generated');
  }

  // ============================================================================
  // BRIDGE SETUP
  // ============================================================================

  function setupBridge() {
    bridgeGroup = new THREE.Group();
    scene.add(bridgeGroup);

    // Bridge arch at position where camera passes under
    const archCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(3, 3, 4),
      new THREE.Vector3(7, 8, 6),
      new THREE.Vector3(11, 3, 8)
    );

    const archPoints = archCurve.getPoints(20);
    const archGeo = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(archPoints),
      20,
      0.4,
      8,
      false
    );

    const archMat = new THREE.MeshLambertMaterial({
      color: 0x1a1a22,
      flatShading: true
    });

    const arch = new THREE.Mesh(archGeo, archMat);
    bridgeGroup.add(arch);

    // Bridge deck
    const deckGeo = new THREE.BoxGeometry(10, 0.3, 12);
    const deck = new THREE.Mesh(deckGeo, archMat);
    deck.position.set(7, 7.5, 6);
    bridgeGroup.add(deck);

    // Neon underlight
    const neonMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const neonLight = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.1, 11),
      neonMat
    );
    neonLight.position.set(7, 7.3, 6);
    bridgeGroup.add(neonLight);

    console.log('✓ Bridge created');
  }

  // ============================================================================
  // POST-PROCESSING SETUP
  // ============================================================================

  function setupPostProcessing() {
    const wrapper = document.getElementById('canvas-wrapper');
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;

    composer = new THREE.EffectComposer(renderer);

    // Render pass
    const renderPass = new THREE.RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Bloom pass
    bloomPass = new THREE.UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.3,  // strength
      0.4,  // radius
      0.85  // threshold
    );
    composer.addPass(bloomPass);

    // Vignette + grain shader
    const vignetteShader = {
      uniforms: {
        tDiffuse: { value: null },
        uVignette: { value: 0.3 },
        uGrain: { value: 0.08 },
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

        void main() {
          vec4 color = texture2D(tDiffuse, vUv);

          // Vignette
          vec2 uv = vUv * 2.0 - 1.0;
          float dist = length(uv);
          float vignette = smoothstep(0.8, 0.3, dist * uVignette * 2.5);
          color.rgb *= vignette;

          // Film grain
          float grain = random(vUv + uTime) * uGrain;
          color.rgb += grain - uGrain * 0.5;

          gl_FragColor = color;
        }
      `
    };

    vignettePass = new THREE.ShaderPass(vignetteShader);
    vignettePass.renderToScreen = true;
    composer.addPass(vignettePass);

    grainPass = vignettePass; // Same pass

    console.log('✓ Post-processing ready');
  }

  // ============================================================================
  // CAMERA PATH & ANIMATION
  // ============================================================================

  function updateCameraPath() {
    if (!sceneData || !sceneData.shots) return;

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
      const points = shot.path.points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
      cameraCurve = new THREE.CatmullRomCurve3(points);
    }

    // Interpolate along shot
    const shotDuration = shot.time[1] - shot.time[0];
    const shotProgress = (currentTime - shot.time[0]) / shotDuration;
    const t = Math.max(0, Math.min(1, shotProgress));

    // Get position on curve
    const pos = cameraCurve.getPoint(t);
    camera.position.copy(pos);

    // Look ahead on curve
    const lookAheadT = Math.min(1, t + 0.05);
    const lookAt = cameraCurve.getPoint(lookAheadT);
    camera.lookAt(lookAt);

    // Interpolate FOV
    const fov = THREE.MathUtils.lerp(shot.camera.fov[0], shot.camera.fov[1], t);
    camera.fov = fov;
    camera.updateProjectionMatrix();

    // Interpolate roll
    const roll = THREE.MathUtils.lerp(
      shot.camera.rollDeg[0] * Math.PI / 180,
      shot.camera.rollDeg[1] * Math.PI / 180,
      t
    );
    camera.rotation.z = roll;

    // Update FX
    updateFX(shot, t);

    // Fade effect at end
    if (shot.fx.fade) {
      const [fadeStart, fadeEnd] = shot.fx.fade;
      if (currentTime >= fadeStart) {
        const fadeT = (currentTime - fadeStart) / (fadeEnd - fadeStart);
        const opacity = 1 - Math.min(1, fadeT);
        renderer.toneMappingExposure = 1.2 * opacity;
      }
    }
  }

  function updateFX(shot, t) {
    // Audio reactivity
    let audioEnergy = 0;
    if (hasAudio && analyser && audioData) {
      analyser.getByteFrequencyData(audioData);
      const sum = audioData.reduce((a, b) => a + b, 0);
      audioEnergy = sum / (audioData.length * 255);
    } else {
      // Fake beat detection from timeline
      const nearestBeat = sceneData.beats.reduce((prev, curr) =>
        Math.abs(curr - currentTime) < Math.abs(prev - currentTime) ? curr : prev
      );
      const beatDist = Math.abs(nearestBeat - currentTime);
      audioEnergy = beatDist < 0.1 ? 0.8 : 0.2;
    }

    // Bloom
    const bloomBase = THREE.MathUtils.lerp(shot.fx.bloom[0], shot.fx.bloom[1], t);
    const bloomPulse = shot.fx.neonPulse * audioEnergy;
    bloomPass.strength = bloomBase + bloomPulse;

    // Vignette
    const vignetteVal = THREE.MathUtils.lerp(shot.fx.vignette[0], shot.fx.vignette[1], t);
    if (vignettePass.uniforms) {
      vignettePass.uniforms.uVignette.value = vignetteVal;
      vignettePass.uniforms.uTime.value = currentTime;
    }
  }

  // ============================================================================
  // AUDIO
  // ============================================================================

  function setupAudio(audioFile) {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Create audio element
    if (audioElement) {
      audioElement.pause();
      audioElement.remove();
    }

    audioElement = document.createElement('audio');
    audioElement.src = URL.createObjectURL(audioFile);
    audioElement.loop = false;

    // Create analyser
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    audioData = new Uint8Array(analyser.frequencyBinCount);

    audioSource = audioContext.createMediaElementSource(audioElement);
    audioSource.connect(analyser);
    analyser.connect(audioContext.destination);

    hasAudio = true;
    console.log('✓ Audio loaded');

    // Sync playback
    if (isPlaying) {
      audioElement.currentTime = currentTime;
      audioElement.play();
    }
  }

  // ============================================================================
  // RECORDING (25fps)
  // ============================================================================

  function startRecording() {
    if (isRecording) return;

    const canvas = document.getElementById('canvas');
    const stream = canvas.captureStream(25); // Lock to 25 fps

    recordedChunks = [];

    const options = {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 8000000 // 8 Mbps for quality
    };

    // Fallback codec
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
      a.download = `drone-night-clip-${Date.now()}.webm`;
      a.click();

      URL.revokeObjectURL(url);
      console.log('✓ Recording saved');
    };

    mediaRecorder.start(100); // Collect data every 100ms
    isRecording = true;
    recordingStartTime = currentTime;

    // Restart from beginning for full recording
    currentTime = 0;
    isPlaying = true;
    if (audioElement) {
      audioElement.currentTime = 0;
      audioElement.play();
    }

    document.getElementById('btn-record').textContent = '⏹ Stop Recording';
    document.getElementById('btn-record').classList.add('recording');

    console.log('Recording started at 25fps');
  }

  function stopRecording() {
    if (!isRecording) return;

    mediaRecorder.stop();
    isRecording = false;

    document.getElementById('btn-record').textContent = '⏺ Record 25fps';
    document.getElementById('btn-record').classList.remove('recording');
  }

  // ============================================================================
  // RENDER LOOP
  // ============================================================================

  function render(timestamp) {
    requestAnimationFrame(render);

    // Calculate delta time
    const delta = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    // FPS counter
    fps = Math.round(1000 / Math.max(delta, 1));

    // Update time
    if (isPlaying) {
      if (isRecording) {
        // Lock to 25 fps during recording
        currentTime += 1 / 25 * playbackSpeed;
      } else {
        currentTime += (delta / 1000) * playbackSpeed;
      }

      // Loop or stop at end
      if (currentTime >= sceneData.meta.duration) {
        if (isRecording) {
          stopRecording();
          isPlaying = false;
        } else {
          currentTime = 0; // Loop
        }
      }

      // Sync audio
      if (audioElement && hasAudio) {
        const audioDiff = Math.abs(audioElement.currentTime - currentTime);
        if (audioDiff > 0.1) {
          audioElement.currentTime = currentTime;
        }
      }
    }

    // Update camera and FX
    updateCameraPath();

    // Render
    composer.render();

    // Update HUD
    updateHUD();
  }

  function updateHUD() {
    document.getElementById('hud-time').textContent = currentTime.toFixed(2) + 's';
    document.getElementById('hud-shot').textContent = currentShot ? currentShot.name : '-';
    document.getElementById('hud-fps').textContent = fps;
    document.getElementById('hud-speed').textContent = playbackSpeed.toFixed(1) + 'x';
    document.getElementById('hud-fov').textContent = Math.round(camera.fov) + '°';
    document.getElementById('hud-bloom').textContent = bloomPass.strength.toFixed(2);
    document.getElementById('hud-audio').textContent = hasAudio ? 'Yes' : 'Beats';
  }

  // ============================================================================
  // UI SETUP
  // ============================================================================

  function setupUI() {
    // Play/Pause
    document.getElementById('btn-play').addEventListener('click', () => {
      isPlaying = !isPlaying;

      if (isPlaying) {
        document.getElementById('btn-play').textContent = '⏸ Pause';
        if (audioElement) audioElement.play();
      } else {
        document.getElementById('btn-play').textContent = '▶ Play';
        if (audioElement) audioElement.pause();
      }
    });

    // Record
    document.getElementById('btn-record').addEventListener('click', () => {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    });

    // Audio input
    document.getElementById('input-audio').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        setupAudio(file);
      }
    });

    // Preset selector
    document.getElementById('preset-select').addEventListener('change', async (e) => {
      const presetPath = e.target.value;
      if (presetPath) {
        try {
          sceneData = await loadJSON(presetPath);
          currentTime = 0;
          currentShot = null;
          console.log('✓ Preset loaded:', presetPath);
        } catch (err) {
          console.error('Failed to load preset:', err);
        }
      } else {
        sceneData = await loadJSON('scene.json');
        currentTime = 0;
        currentShot = null;
      }
    });

    // Window resize
    window.addEventListener('resize', onResize);
  }

  function setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      switch(e.key) {
        case ' ':
          e.preventDefault();
          document.getElementById('btn-play').click();
          break;
        case 'h':
        case 'H':
          hudVisible = !hudVisible;
          const hud = document.getElementById('hud');
          if (hudVisible) hud.classList.add('visible');
          else hud.classList.remove('visible');
          break;
        case ',':
          playbackSpeed = Math.max(0.5, playbackSpeed - 0.25);
          break;
        case '.':
          playbackSpeed = Math.min(2.0, playbackSpeed + 0.25);
          break;
        case 'r':
        case 'R':
          currentTime = 0;
          if (audioElement) audioElement.currentTime = 0;
          break;
      }
    });
  }

  function onResize() {
    const wrapper = document.getElementById('canvas-wrapper');
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    composer.setSize(width, height);
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  async function loadJSON(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to load ${path}`);
    return await response.json();
  }

  function seededRandom(seed) {
    let s = seed;
    return function() {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  // ============================================================================
  // START
  // ============================================================================

  // Wait for DOM and Three.js to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(init, 100);
    });
  } else {
    setTimeout(init, 100);
  }

})();

/**
 * Drone Night POV - Three.js Main Application
 * Enhanced with file:// support, chromatic aberration, camera oscillation, and motion streaks
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
  let isLocalMode = false;

  // Camera path
  let cameraCurve = null;
  let currentShot = null;
  let cameraOscillationPhase = 0;

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

  // City objects (reusable)
  let cityGroup = null;
  let bridgeGroup = null;

  // Post-processing
  let bloomPass = null;
  let vignettePass = null;
  let chromaticPass = null;

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
      // Load scene configuration (with file:// detection)
      sceneData = await loadSceneData('scene.json');
      console.log('✓ Scene loaded:', sceneData.meta.title);

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
      showFriendlyError(error);
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

  function showFriendlyError(error) {
    const loading = document.getElementById('loading');
    const isFileProtocol = window.location.protocol === 'file:';

    let message = '';

    if (isFileProtocol) {
      message = `
        <div style="color: #ffaa44; max-width: 400px; line-height: 1.6;">
          <h3 style="margin-bottom: 10px;">📁 Local File Mode</h3>
          <p style="font-size: 14px; margin-bottom: 10px;">
            For best experience, serve via GitHub Pages or a local server:
          </p>
          <code style="display: block; background: rgba(0,0,0,0.5); padding: 8px; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
            python -m http.server 8000<br>
            # or<br>
            npx http-server -p 8000
          </code>
          <p style="font-size: 12px;">See README.md for details.</p>
        </div>
      `;
    } else {
      message = `
        <div style="color: #ff3333;">
          <h3>Error</h3>
          <p>${error.message}</p>
          <p style="font-size: 12px; margin-top: 10px;">Check console for details.</p>
        </div>
      `;
    }

    loading.innerHTML = message;
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
    renderer.toneMappingExposure = 1.3;
  }

  function setupScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000510);
    scene.fog = new THREE.FogExp2(0x000510, 0.012);
  }

  function setupCamera() {
    const wrapper = document.getElementById('canvas-wrapper');
    const aspect = wrapper.clientWidth / wrapper.clientHeight;

    camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 300);
    camera.position.set(0, 20, 50);
    camera.lookAt(0, 0, 0);
  }

  function setupLights() {
    // Ambient light
    const ambient = new THREE.AmbientLight(0x0a0a15, 0.25);
    scene.add(ambient);

    // Directional light (moonlight)
    const moon = new THREE.DirectionalLight(0x3366aa, 0.35);
    moon.position.set(50, 100, 50);
    scene.add(moon);

    // Hemisphere light
    const hemi = new THREE.HemisphereLight(0x0a0a20, 0x000510, 0.4);
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

    const seed = sceneData.meta.seed || 42;
    let rng = seededRandom(seed);

    const gridSize = 20;
    const blockSize = 8;

    for (let x = -gridSize; x < gridSize; x += blockSize) {
      for (let z = -gridSize; z < gridSize; z += blockSize) {
        // Skip camera path area
        if (x > -10 && x < 15 && z > 0 && z < 60) continue;

        const buildingCount = Math.floor(rng() * 3) + 1;

        for (let i = 0; i < buildingCount; i++) {
          const bx = x + (rng() - 0.5) * blockSize * 0.8;
          const bz = z + (rng() - 0.5) * blockSize * 0.8;
          const width = 2 + rng() * 3;
          const depth = 2 + rng() * 3;
          const height = 5 + rng() * 25;

          // Building body (darker for more contrast)
          const buildingMat = new THREE.MeshLambertMaterial({
            color: new THREE.Color(0.015, 0.015, 0.025),
            flatShading: true
          });

          const building = new THREE.Mesh(buildingGeo, buildingMat);
          building.scale.set(width, height, depth);
          building.position.set(bx, height / 2, bz);
          building.castShadow = true;
          building.receiveShadow = true;
          cityGroup.add(building);

          // Windows with stronger emissive
          const windowCount = Math.floor(height / 2) * 4;
          const isNeon = rng() > 0.65;
          const windowColor = isNeon ? 0x00ffff : 0xffaa44;

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

          // Neon accent rooftops
          if (rng() > 0.8) {
            const neonColor = rng() > 0.5 ? 0x00ffff : 0xff6600;
            const neonMat = new THREE.MeshBasicMaterial({
              color: neonColor,
              transparent: true,
              opacity: 0.8
            });
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
      color: 0x050508,
      side: THREE.DoubleSide
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    cityGroup.add(ground);

    console.log('✓ City generated');
  }

  // ============================================================================
  // BRIDGE SETUP
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

    const archMat = new THREE.MeshLambertMaterial({
      color: 0x15151a,
      flatShading: true
    });

    const arch = new THREE.Mesh(archGeo, archMat);
    arch.castShadow = true;
    bridgeGroup.add(arch);

    // Bridge deck
    const deckGeo = new THREE.BoxGeometry(10, 0.4, 12);
    const deck = new THREE.Mesh(deckGeo, archMat);
    deck.position.set(7, 8, 6);
    deck.castShadow = true;
    bridgeGroup.add(deck);

    // Neon underlight (stronger)
    const neonMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.7
    });
    const neonLight = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.15, 11),
      neonMat
    );
    neonLight.position.set(7, 7.8, 6);
    bridgeGroup.add(neonLight);

    console.log('✓ Bridge created');
  }

  // ============================================================================
  // ENHANCED POST-PROCESSING
  // ============================================================================

  function setupPostProcessing() {
    const wrapper = document.getElementById('canvas-wrapper');
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;

    composer = new THREE.EffectComposer(renderer);

    // Render pass
    const renderPass = new THREE.RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Bloom pass (stronger for neon glow)
    bloomPass = new THREE.UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.4,
      0.5,
      0.82
    );
    composer.addPass(bloomPass);

    // Chromatic Aberration + Vignette + Grain shader
    const enhancedShader = {
      uniforms: {
        tDiffuse: { value: null },
        uVignette: { value: 0.3 },
        uGrain: { value: 0.10 },
        uTime: { value: 0 },
        uChromaticAberration: { value: 0.0 },
        uResolution: { value: new THREE.Vector2(width, height) }
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
        uniform float uChromaticAberration;
        uniform vec2 uResolution;
        varying vec2 vUv;

        // Noise function
        float random(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        // Better film grain with temporal variation
        float filmGrain(vec2 uv, float time) {
          vec2 uvRandom = uv;
          uvRandom.y *= random(vec2(uvRandom.y, time));
          return random(uvRandom);
        }

        void main() {
          vec2 uv = vUv;

          // Chromatic aberration
          float aberration = uChromaticAberration;
          vec2 direction = uv - 0.5;

          float r = texture2D(tDiffuse, uv + direction * aberration).r;
          float g = texture2D(tDiffuse, uv).g;
          float b = texture2D(tDiffuse, uv - direction * aberration).b;

          vec4 color = vec4(r, g, b, 1.0);

          // Vignette (stronger)
          vec2 vignetteUv = uv * 2.0 - 1.0;
          float dist = length(vignetteUv);
          float vignette = smoothstep(0.9, 0.2, dist * uVignette * 3.0);
          color.rgb *= vignette;

          // Animated film grain
          float grain = filmGrain(uv * 2.5, uTime * 10.0) * uGrain;
          color.rgb += grain - uGrain * 0.5;

          // Subtle color grade (teal shadows, amber highlights)
          color.r *= 1.05;
          color.g *= 0.98;
          color.b *= 1.08;

          gl_FragColor = color;
        }
      `
    };

    chromaticPass = new THREE.ShaderPass(enhancedShader);
    chromaticPass.renderToScreen = true;
    composer.addPass(chromaticPass);

    vignettePass = chromaticPass;

    console.log('✓ Enhanced post-processing ready');
  }

  // ============================================================================
  // ENHANCED CAMERA PATH & ANIMATION
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

    // Camera oscillation (micro-shake for handheld feel)
    const oscillation = shot.camera.oscillation || 0;
    if (oscillation > 0) {
      cameraOscillationPhase += 0.08;
      const oscX = Math.sin(cameraOscillationPhase * 2.3) * oscillation * 0.3;
      const oscY = Math.sin(cameraOscillationPhase * 3.1) * oscillation * 0.2;
      const oscZ = Math.sin(cameraOscillationPhase * 1.7) * oscillation * 0.15;
      camera.position.x += oscX;
      camera.position.y += oscY;
      camera.position.z += oscZ;
    }

    // Look ahead on curve
    const lookAheadT = Math.min(1, t + 0.05);
    const lookAt = cameraCurve.getPoint(lookAheadT);
    camera.lookAt(lookAt);

    // Interpolate FOV
    const fov = THREE.MathUtils.lerp(shot.camera.fov[0], shot.camera.fov[1], t);
    camera.fov = fov;
    camera.updateProjectionMatrix();

    // Interpolate roll with audio pulse
    const baseRoll = THREE.MathUtils.lerp(
      shot.camera.rollDeg[0] * Math.PI / 180,
      shot.camera.rollDeg[1] * Math.PI / 180,
      t
    );

    // Add rhythmic camera jitter on beats
    let beatJitter = 0;
    const nearestBeat = sceneData.beats.reduce((prev, curr) =>
      Math.abs(curr - currentTime) < Math.abs(prev - currentTime) ? curr : prev
    );
    const beatDist = Math.abs(nearestBeat - currentTime);
    if (beatDist < 0.08) {
      beatJitter = (0.08 - beatDist) * 0.5;
    }

    camera.rotation.z = baseRoll + beatJitter;

    // Update FX
    updateFX(shot, t);

    // Fade effect
    if (shot.fx.fade) {
      const [fadeStart, fadeEnd] = shot.fx.fade;
      if (currentTime >= fadeStart) {
        const fadeT = (currentTime - fadeStart) / (fadeEnd - fadeStart);
        const opacity = 1 - Math.min(1, fadeT);
        renderer.toneMappingExposure = 1.3 * opacity;
      }
    } else {
      renderer.toneMappingExposure = 1.3;
    }
  }

  function updateFX(shot, t) {
    // Audio reactivity
    let audioEnergy = 0;
    if (hasAudio && analyser && audioData) {
      analyser.getByteFrequencyData(audioData);
      // Focus on bass frequencies (0-100Hz range)
      const bassData = audioData.slice(0, Math.floor(audioData.length * 0.1));
      const sum = bassData.reduce((a, b) => a + b, 0);
      audioEnergy = sum / (bassData.length * 255);
    } else {
      // Fake beat detection
      const nearestBeat = sceneData.beats.reduce((prev, curr) =>
        Math.abs(curr - currentTime) < Math.abs(prev - currentTime) ? curr : prev
      );
      const beatDist = Math.abs(nearestBeat - currentTime);
      audioEnergy = beatDist < 0.1 ? Math.pow(1 - beatDist / 0.1, 2) : 0.1;
    }

    // Bloom (pulse with beats)
    const bloomBase = THREE.MathUtils.lerp(shot.fx.bloom[0], shot.fx.bloom[1], t);
    const bloomPulse = shot.fx.neonPulse * audioEnergy;
    bloomPass.strength = bloomBase + bloomPulse;

    // Vignette
    const vignetteVal = THREE.MathUtils.lerp(shot.fx.vignette[0], shot.fx.vignette[1], t);
    if (vignettePass.uniforms) {
      vignettePass.uniforms.uVignette.value = vignetteVal;
      vignettePass.uniforms.uTime.value = currentTime;

      // Chromatic aberration (from shot config)
      const aberration = shot.fx.chromaticAberration || 0;
      vignettePass.uniforms.uChromaticAberration.value = aberration + audioEnergy * 0.001;

      // Grain (slightly more on beats)
      vignettePass.uniforms.uGrain.value = 0.10 + audioEnergy * 0.05;
    }
  }

  // ============================================================================
  // AUDIO SETUP
  // ============================================================================

  function setupAudio(audioFile) {
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
    console.log('✓ Audio loaded with analyser');

    if (isPlaying) {
      audioElement.currentTime = currentTime;
      audioElement.play();
    }
  }

  // ============================================================================
  // RECORDING (25fps locked)
  // ============================================================================

  function startRecording() {
    if (isRecording) return;

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
      a.download = `drone-night-${sceneData.meta.title.replace(/\s+/g, '-')}-${Date.now()}.webm`;
      a.click();

      URL.revokeObjectURL(url);
      console.log('✓ Recording saved');
    };

    mediaRecorder.start(100);
    isRecording = true;

    currentTime = 0;
    isPlaying = true;
    if (audioElement) {
      audioElement.currentTime = 0;
      audioElement.play();
    }

    document.getElementById('btn-record').textContent = '⏹ Stop Recording';
    document.getElementById('btn-record').classList.add('recording');

    console.log('🎬 Recording started at 25fps');
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

    const delta = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    fps = Math.round(1000 / Math.max(delta, 1));

    if (isPlaying) {
      if (isRecording) {
        // Lock to 25fps
        currentTime += 1 / 25 * playbackSpeed;
      } else {
        currentTime += (delta / 1000) * playbackSpeed;
      }

      if (currentTime >= sceneData.meta.duration) {
        if (isRecording) {
          stopRecording();
          isPlaying = false;
        } else {
          currentTime = 0;
        }
      }

      if (audioElement && hasAudio) {
        const audioDiff = Math.abs(audioElement.currentTime - currentTime);
        if (audioDiff > 0.1) {
          audioElement.currentTime = currentTime;
        }
      }
    }

    updateCameraPath();
    composer.render();
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

    document.getElementById('btn-record').addEventListener('click', () => {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    });

    document.getElementById('input-audio').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        setupAudio(file);
      }
    });

    document.getElementById('preset-select').addEventListener('change', async (e) => {
      const presetPath = e.target.value;
      if (presetPath) {
        try {
          sceneData = await loadSceneData(presetPath);
          currentTime = 0;
          currentShot = null;
          console.log('✓ Preset loaded:', presetPath);
        } catch (err) {
          console.error('Failed to load preset:', err);
        }
      } else {
        sceneData = await loadSceneData('scene.json');
        currentTime = 0;
        currentShot = null;
      }
    });

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

    if (chromaticPass.uniforms) {
      chromaticPass.uniforms.uResolution.value.set(width, height);
    }
  }

  // ============================================================================
  // ENHANCED DATA LOADING (file:// support)
  // ============================================================================

  async function loadSceneData(path) {
    // Detect file:// protocol
    const isFileProtocol = window.location.protocol === 'file:';

    // Try to fetch normally first
    if (!isFileProtocol) {
      try {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (fetchError) {
        console.warn('Fetch failed, trying inline fallback:', fetchError);
      }
    }

    // Use inline scene data
    return loadInlineScene(path);
  }

  function loadInlineScene(path) {
    // Map paths to inline script IDs
    const pathMap = {
      'scene.json': 'scene-default',
      'presets/soft.json': 'scene-soft',
      'presets/intense.json': 'scene-intense',
      'presets/dark.json': 'scene-dark',
      'presets/insane.json': 'scene-insane'
    };

    const scriptId = pathMap[path] || 'scene-default';
    const scriptEl = document.getElementById(scriptId);

    if (!scriptEl) {
      throw new Error(`Inline scene not found: ${scriptId}`);
    }

    const data = JSON.parse(scriptEl.textContent);

    // Show local mode indicator
    if (!isLocalMode) {
      isLocalMode = true;
      const indicator = document.getElementById('local-mode');
      if (indicator) indicator.classList.add('visible');
      console.log('📁 Running in local mode (inline scenes)');
    }

    return data;
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

  // ============================================================================
  // START
  // ============================================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(init, 100);
    });
  } else {
    setTimeout(init, 100);
  }

})();

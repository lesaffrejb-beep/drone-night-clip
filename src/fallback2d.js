/**
 * Drone Night POV - Canvas 2D Fallback
 * Simplified 2.5D renderer for browsers without WebGL support
 */

(function() {
  'use strict';

  // ============================================================================
  // GLOBAL STATE
  // ============================================================================

  let canvas, ctx;
  let sceneData = null;
  let currentTime = 0;
  let isPlaying = false;
  let playbackSpeed = 1.0;
  let hudVisible = false;
  let lastFrameTime = 0;
  let fps = 60;

  let currentShot = null;
  let buildings = [];
  let audioElement = null;
  let hasAudio = false;
  let isLocalMode = false;

  // Recording
  let mediaRecorder = null;
  let recordedChunks = [];
  let isRecording = false;

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  window.initFallback2D = async function() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');

    const loading = document.getElementById('loading');

    try {
      // Load scene (with file:// detection)
      sceneData = await loadSceneData('scene.json');
      console.log('[2D Fallback] Scene loaded:', sceneData.meta.title);

      // Setup canvas size
      resizeCanvas();

      // Generate city
      generateCity();

      // Setup UI
      setupUI();
      setupKeyboard();

      // Hide loading
      loading.classList.add('hidden');

      // Start render
      lastFrameTime = performance.now();
      requestAnimationFrame(render);

      console.log('✓ 2D Fallback initialized');
    } catch (error) {
      console.error('[2D Fallback] Init failed:', error);
      loading.innerHTML = `<div style="color: #ff3333;">Error: ${error.message}</div>`;
    }
  };

  function resizeCanvas() {
    const wrapper = document.getElementById('canvas-wrapper');
    canvas.width = wrapper.clientWidth;
    canvas.height = wrapper.clientHeight;
  }

  // ============================================================================
  // CITY GENERATION (2D)
  // ============================================================================

  function generateCity() {
    buildings = [];

    const seed = sceneData.meta.seed || 42;
    let rng = seededRandom(seed);

    // Generate building data
    for (let i = 0; i < 80; i++) {
      const x = (rng() - 0.5) * 100;
      const z = rng() * 100;
      const width = 2 + rng() * 4;
      const height = 5 + rng() * 20;
      const color = rng() > 0.7 ? '#00ffff' : '#ffaa44';

      buildings.push({ x, z, width, height, color });
    }

    // Sort by depth for painter's algorithm
    buildings.sort((a, b) => b.z - a.z);

    console.log('[2D Fallback] City generated:', buildings.length, 'buildings');
  }

  // ============================================================================
  // CAMERA & PATH
  // ============================================================================

  function getCameraState(time) {
    // Find current shot
    let shot = null;
    for (const s of sceneData.shots) {
      if (time >= s.time[0] && time < s.time[1]) {
        shot = s;
        break;
      }
    }

    if (!shot) {
      shot = sceneData.shots[sceneData.shots.length - 1];
    }

    const shotDuration = shot.time[1] - shot.time[0];
    const t = Math.max(0, Math.min(1, (time - shot.time[0]) / shotDuration));

    // Interpolate position (simple lerp for 2D)
    const points = shot.path.points;
    const segmentCount = points.length - 1;
    const segmentT = t * segmentCount;
    const segmentIndex = Math.floor(segmentT);
    const segmentFrac = segmentT - segmentIndex;

    const p1 = points[Math.min(segmentIndex, segmentCount - 1)];
    const p2 = points[Math.min(segmentIndex + 1, segmentCount)];

    const x = lerp(p1[0], p2[0], segmentFrac);
    const y = lerp(p1[1], p2[1], segmentFrac);
    const z = lerp(p1[2], p2[2], segmentFrac);

    // Interpolate effects
    const bloom = lerp(shot.fx.bloom[0], shot.fx.bloom[1], t);
    const vignette = lerp(shot.fx.vignette[0], shot.fx.vignette[1], t);
    const fov = lerp(shot.camera.fov[0], shot.camera.fov[1], t);

    // Audio energy (simplified)
    let audioEnergy = 0;
    const nearestBeat = sceneData.beats.reduce((prev, curr) =>
      Math.abs(curr - time) < Math.abs(prev - time) ? curr : prev
    );
    const beatDist = Math.abs(nearestBeat - time);
    audioEnergy = beatDist < 0.1 ? 1.0 : 0.2;

    return {
      shot,
      x, y, z, t,
      fov,
      bloom: bloom + shot.fx.neonPulse * audioEnergy,
      vignette,
      fade: shot.fx.fade && time >= shot.fx.fade[0] ?
        1 - Math.min(1, (time - shot.fx.fade[0]) / (shot.fx.fade[1] - shot.fx.fade[0])) : 1
    };
  }

  // ============================================================================
  // RENDERING
  // ============================================================================

  function render(timestamp) {
    requestAnimationFrame(render);

    const delta = timestamp - lastFrameTime;
    lastFrameTime = timestamp;
    fps = Math.round(1000 / Math.max(delta, 1));

    // Update time
    if (isPlaying) {
      if (isRecording) {
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
        const diff = Math.abs(audioElement.currentTime - currentTime);
        if (diff > 0.1) {
          audioElement.currentTime = currentTime;
        }
      }
    }

    // Get camera state
    const cam = getCameraState(currentTime);
    currentShot = cam.shot;

    // Clear canvas
    ctx.fillStyle = '#000510';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw scene
    drawScene(cam);

    // Apply post-FX
    applyPostFX(cam);

    // Update HUD
    updateHUD(cam);
  }

  function drawScene(cam) {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Perspective scale based on FOV
    const scale = 800 / cam.fov;

    // Draw buildings
    for (const building of buildings) {
      // Calculate relative position
      const dx = building.x - cam.x;
      const dz = building.z - cam.z;
      const dy = 0 - cam.y;

      // Skip if behind camera
      if (dz < 1) continue;

      // Project to screen
      const screenX = centerX + (dx / dz) * scale;
      const screenY = centerY + (dy / dz) * scale;
      const screenW = (building.width / dz) * scale;
      const screenH = (building.height / dz) * scale;

      // Depth-based brightness
      const brightness = Math.max(0, Math.min(1, 1 - dz / 80));
      const alpha = brightness * 0.8;

      // Building body
      ctx.fillStyle = `rgba(10, 10, 20, ${alpha})`;
      ctx.fillRect(screenX - screenW / 2, screenY - screenH, screenW, screenH);

      // Windows (only on near buildings)
      if (dz < 40 && screenH > 20) {
        ctx.fillStyle = building.color + Math.floor(brightness * 255).toString(16).padStart(2, '0');
        const windowSize = Math.max(2, screenW * 0.15);
        const windowCount = Math.floor(screenH / (windowSize * 2));

        for (let i = 0; i < windowCount; i++) {
          if (Math.random() > 0.4) {
            ctx.fillRect(
              screenX - windowSize / 2,
              screenY - screenH + i * windowSize * 2,
              windowSize,
              windowSize * 0.8
            );
          }
        }
      }

      // Neon glow for near buildings
      if (brightness > 0.6 && Math.random() > 0.9) {
        ctx.fillStyle = `rgba(0, 255, 255, ${brightness * cam.bloom})`;
        ctx.fillRect(screenX - screenW / 2, screenY - screenH - 5, screenW, 3);
      }
    }

    // Draw bridge (if in range)
    if (cam.z > 4 && cam.z < 10) {
      const bridgeZ = 6;
      const bridgeDZ = bridgeZ - cam.z;

      if (bridgeDZ > 0.1) {
        const bridgeScreenY = centerY + ((7.5 - cam.y) / bridgeDZ) * scale;
        const bridgeScreenW = (10 / bridgeDZ) * scale;

        // Arch
        ctx.strokeStyle = `rgba(0, 255, 255, ${cam.bloom * 0.8})`;
        ctx.lineWidth = Math.max(2, (0.4 / bridgeDZ) * scale);
        ctx.beginPath();
        ctx.arc(centerX, bridgeScreenY, bridgeScreenW / 2, 0, Math.PI, true);
        ctx.stroke();

        // Deck
        ctx.fillStyle = 'rgba(26, 26, 34, 0.9)';
        ctx.fillRect(centerX - bridgeScreenW / 2, bridgeScreenY - 10, bridgeScreenW, 8);
      }
    }
  }

  function applyPostFX(cam) {
    const w = canvas.width;
    const h = canvas.height;

    // Vignette
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, `rgba(0, 0, 0, ${cam.vignette})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // Film grain
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const grainStrength = 15;

    for (let i = 0; i < data.length; i += 4) {
      if (Math.random() > 0.5) {
        const grain = (Math.random() - 0.5) * grainStrength;
        data[i] += grain;     // R
        data[i + 1] += grain; // G
        data[i + 2] += grain; // B
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Fade
    if (cam.fade < 1) {
      ctx.fillStyle = `rgba(0, 0, 0, ${1 - cam.fade})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  // ============================================================================
  // RECORDING
  // ============================================================================

  function startRecording() {
    if (isRecording) return;

    const stream = canvas.captureStream(25);
    recordedChunks = [];

    const options = {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 8000000
    };

    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'video/webm;codecs=vp8';
    }

    mediaRecorder = new MediaRecorder(stream, options);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `drone-night-clip-2d-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
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
  }

  function stopRecording() {
    if (!isRecording) return;
    mediaRecorder.stop();
    isRecording = false;
    document.getElementById('btn-record').textContent = '⏺ Record 25fps';
    document.getElementById('btn-record').classList.remove('recording');
  }

  // ============================================================================
  // UI
  // ============================================================================

  function setupUI() {
    document.getElementById('btn-play').addEventListener('click', () => {
      isPlaying = !isPlaying;
      document.getElementById('btn-play').textContent = isPlaying ? '⏸ Pause' : '▶ Play';

      if (isPlaying && audioElement) audioElement.play();
      else if (audioElement) audioElement.pause();
    });

    document.getElementById('btn-record').addEventListener('click', () => {
      if (isRecording) stopRecording();
      else startRecording();
    });

    document.getElementById('input-audio').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) setupAudio(file);
    });

    document.getElementById('preset-select').addEventListener('change', async (e) => {
      const path = e.target.value || 'scene.json';
      try {
        sceneData = await loadSceneData(path);
        currentTime = 0;
        currentShot = null;
        generateCity();
      } catch (err) {
        console.error('Failed to load preset:', err);
      }
    });

    window.addEventListener('resize', resizeCanvas);
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

  function setupAudio(file) {
    if (audioElement) {
      audioElement.pause();
      audioElement.remove();
    }

    audioElement = document.createElement('audio');
    audioElement.src = URL.createObjectURL(file);
    audioElement.loop = false;
    hasAudio = true;

    if (isPlaying) {
      audioElement.currentTime = currentTime;
      audioElement.play();
    }
  }

  function updateHUD(cam) {
    document.getElementById('hud-time').textContent = currentTime.toFixed(2) + 's';
    document.getElementById('hud-shot').textContent = currentShot ? currentShot.name : '-';
    document.getElementById('hud-fps').textContent = fps;
    document.getElementById('hud-speed').textContent = playbackSpeed.toFixed(1) + 'x';
    document.getElementById('hud-fov').textContent = Math.round(cam.fov) + '°';
    document.getElementById('hud-bloom').textContent = cam.bloom.toFixed(2);
    document.getElementById('hud-audio').textContent = hasAudio ? 'Yes' : 'Beats';
  }

  // ============================================================================
  // ENHANCED DATA LOADING (file:// support)
  // ============================================================================

  async function loadSceneData(path) {
    const isFileProtocol = window.location.protocol === 'file:';

    if (!isFileProtocol) {
      try {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (fetchError) {
        console.warn('[2D] Fetch failed, using inline:', fetchError);
      }
    }

    return loadInlineScene(path);
  }

  function loadInlineScene(path) {
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

    if (!isLocalMode) {
      isLocalMode = true;
      const indicator = document.getElementById('local-mode');
      if (indicator) indicator.classList.add('visible');
      console.log('[2D] 📁 Running in local mode');
    }

    return data;
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function seededRandom(seed) {
    let s = seed;
    return function() {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

})();

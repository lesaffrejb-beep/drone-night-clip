import {
  BASE_FOG_DENSITY,
  LOG_PREFIX,
  TARGET_ASPECT,
  TARGET_HEIGHT,
  TARGET_WIDTH
} from './config.js';
import { runtime } from './state.js';
import { seededRandom } from './utils.js';

export function setupRenderer(canvas) {
  runtime.renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true
  });

  runtime.renderer.setSize(TARGET_WIDTH, TARGET_HEIGHT, false);
  runtime.renderer.domElement.style.width = '100%';
  runtime.renderer.domElement.style.height = '100%';
  runtime.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  runtime.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  runtime.renderer.toneMappingExposure = 0.95;
  console.log(LOG_PREFIX, 'Renderer setup');
}

export function setupScene() {
  runtime.scene = new THREE.Scene();
  runtime.scene.background = new THREE.Color(0x000000);
  runtime.cityFogDensity = BASE_FOG_DENSITY;
  runtime.scene.fog = new THREE.FogExp2(0x000000, runtime.cityFogDensity);
  console.log(LOG_PREFIX, 'Scene setup (B&W mode)');
}

export function setupCamera() {
  runtime.camera = new THREE.PerspectiveCamera(68, TARGET_ASPECT, 0.1, 400);
  runtime.camera.position.set(0, 32, 90);
  runtime.camera.lookAt(0, 0, 0);
  console.log(LOG_PREFIX, 'Camera setup');
}

export function setupLights() {
  const ambient = new THREE.AmbientLight(0xffffff, 0.15);
  runtime.scene.add(ambient);

  const moon = new THREE.DirectionalLight(0xffffff, 0.25);
  moon.position.set(50, 100, 50);
  runtime.scene.add(moon);

  const hemi = new THREE.HemisphereLight(0x222222, 0x000000, 0.3);
  runtime.scene.add(hemi);

  console.log(LOG_PREFIX, 'Lights setup (monochrome)');
}

export function setupCity(seed) {
  runtime.cityGroup = new THREE.Group();
  runtime.scene.add(runtime.cityGroup);

  const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
  const windowGeo = new THREE.PlaneGeometry(0.3, 0.4);

  const rng = seededRandom(seed);

  runtime.windowLights = [];
  runtime.accentLights = [];
  runtime.skylineLayers = [];
  runtime.godRayMeshes = [];
  runtime.droneTrailMeshes = [];
  runtime.starfield = null;
  runtime.moonMesh = null;

  const gridSize = 120;
  const blockSize = 12;
  let buildingCount = 0;

  for (let x = -gridSize; x < gridSize; x += blockSize) {
    for (let z = -gridSize; z < gridSize; z += blockSize) {
      if (x > -12 && x < 18 && z > -120 && z < 160) continue;

      const numBuildings = Math.floor(rng() * 3) + 1;

      for (let i = 0; i < numBuildings; i++) {
        const bx = x + (rng() - 0.5) * blockSize * 0.8;
        const bz = z + (rng() - 0.5) * blockSize * 0.8;
        const width = 2 + rng() * 3;
        const depth = 2 + rng() * 3;
        const height = 5 + rng() * 25;

        const buildingMat = new THREE.MeshLambertMaterial({
          color: new THREE.Color(0.01, 0.01, 0.01),
          flatShading: true
        });

        const building = new THREE.Mesh(buildingGeo, buildingMat);
        building.scale.set(width, height, depth);
        building.position.set(bx, height / 2, bz);
        runtime.cityGroup.add(building);
        buildingCount++;

        const windowCount = Math.floor(height / 2) * 4;
        const brightness = 0.85 + rng() * 0.15;
        const windowColor = new THREE.Color(brightness, brightness, brightness);

        const windowMat = new THREE.MeshBasicMaterial({
          color: windowColor,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.75
        });

        for (let w = 0; w < windowCount; w++) {
          if (rng() > 0.35) {
            const win = new THREE.Mesh(windowGeo, windowMat.clone());
            const side = Math.floor(rng() * 4);
            const wy = 2 + (rng() * (height - 4));

            if (side === 0) win.position.set(bx + width / 2, wy, bz);
            else if (side === 1) win.position.set(bx - width / 2, wy, bz);
            else if (side === 2) win.position.set(bx, wy, bz + depth / 2);
            else win.position.set(bx, wy, bz - depth / 2);

            if (side < 2) win.rotation.y = Math.PI / 2;

            win.userData.base = 0.4 + rng() * 0.5;
            win.userData.flicker = 0.3 + rng() * 0.6;
            runtime.windowLights.push(win);
            runtime.cityGroup.add(win);
          }
        }

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
          runtime.accentLights.push(accent);
          runtime.cityGroup.add(accent);
        }
      }
    }
  }

  const groundGeo = new THREE.PlaneGeometry(200, 200);
  const groundMat = new THREE.MeshLambertMaterial({
    color: 0x050505,
    side: THREE.DoubleSide
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  runtime.cityGroup.add(ground);

  createParallaxSkyline(runtime.cityGroup, seededRandom(seed + 101));
  createCelestialElements(runtime.cityGroup, seededRandom(seed + 202));
  createDroneTrails(runtime.cityGroup, seededRandom(seed + 303));

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

    runtime.skylineLayers.push({ group: skyline, parallax: layer.parallax });
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

  runtime.starfield = new THREE.Points(starGeometry, starMaterial);
  runtime.starfield.userData.baseOpacity = 0.3;
  parent.add(runtime.starfield);

  const moonGeo = new THREE.CircleGeometry(7.5, 64);
  const moonMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  runtime.moonMesh = new THREE.Mesh(moonGeo, moonMat);
  runtime.moonMesh.position.set(-46, 88, -190);
  runtime.moonMesh.userData.baseOpacity = 0.82;
  parent.add(runtime.moonMesh);

  const moonGlowGeo = new THREE.CircleGeometry(12, 64);
  const moonGlowMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const moonGlow = new THREE.Mesh(moonGlowGeo, moonGlowMat);
  moonGlow.position.copy(runtime.moonMesh.position);
  moonGlow.userData = { baseOpacity: 0.18, swing: 0, speed: 0, isGlow: true };
  parent.add(moonGlow);
  runtime.godRayMeshes.push(moonGlow);

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
    runtime.godRayMeshes.push(ray);
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
    runtime.droneTrailMeshes.push(mesh);
  });
}

export function setupBridge() {
  runtime.bridgeGroup = new THREE.Group();
  runtime.scene.add(runtime.bridgeGroup);

  runtime.underbridgeLights = [];
  runtime.bridgeSearchLights = [];

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
    color: 0x111111,
    flatShading: true
  });

  const arch = new THREE.Mesh(archGeo, archMat);
  runtime.bridgeGroup.add(arch);

  const deckGeo = new THREE.BoxGeometry(10, 0.4, 12);
  const deck = new THREE.Mesh(deckGeo, archMat);
  deck.position.set(7, 8, 6);
  runtime.bridgeGroup.add(deck);

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
  runtime.underbridgeLights.push(underlight);
  runtime.bridgeGroup.add(underlight);

  const lampGeo = new THREE.CylinderGeometry(0.08, 0.12, 3.2, 12);
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x0b0b0b });
  const lampCapGeo = new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const lampLightMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.45
  });

  const lampRng = seededRandom(runtime.currentSeed + 1337);

  for (let i = -4; i <= 4; i++) {
    const post = new THREE.Mesh(lampGeo, lampMat);
    post.position.set(7 + i * 1.6, 6.6, 6 + (i % 2 === 0 ? 2.8 : -2.8));
    runtime.bridgeGroup.add(post);

    const cap = new THREE.Mesh(lampCapGeo, lampLightMat.clone());
    cap.position.set(post.position.x, 8.2, post.position.z);
    cap.rotation.x = Math.PI;
    cap.userData.base = 0.25 + lampRng() * 0.35;
    cap.userData.flicker = 0.4 + lampRng() * 0.5;
    runtime.underbridgeLights.push(cap);
    runtime.bridgeGroup.add(cap);
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
    runtime.bridgeGroup.add(beam);
    runtime.bridgeSearchLights.push(beam);
  }

  console.log(LOG_PREFIX, 'Bridge created (B&W)');
}

export function disposeGroup(group) {
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

export function clearEnvironment() {
  if (runtime.cityGroup) {
    disposeGroup(runtime.cityGroup);
    runtime.scene.remove(runtime.cityGroup);
    runtime.cityGroup = null;
  }
  if (runtime.bridgeGroup) {
    disposeGroup(runtime.bridgeGroup);
    runtime.scene.remove(runtime.bridgeGroup);
    runtime.bridgeGroup = null;
  }
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

export function rebuildEnvironmentForScene() {
  clearEnvironment();
  setupCity(runtime.currentSeed);
  setupBridge();
}

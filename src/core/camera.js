import { BASE_FOG_DENSITY, LOG_PREFIX } from './config.js';
import { runtime, tempoState } from './state.js';
import { applyEasing } from './utils.js';

export function updateCameraPath() {
  const data = runtime.sceneData;
  if (!data || !Array.isArray(data.shots) || data.shots.length === 0) {
    return;
  }

  let shot = null;
  for (const s of data.shots) {
    if (runtime.currentTime >= s.time[0] && runtime.currentTime < s.time[1]) {
      shot = s;
      break;
    }
  }

  if (!shot) {
    shot = data.shots[data.shots.length - 1];
  }

  if (runtime.currentShot !== shot) {
    runtime.currentShot = shot;
    try {
      const points = shot.path.points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
      runtime.cameraCurve = new THREE.CatmullRomCurve3(points);
      runtime.cameraOscillationPhase = 0;
    } catch (err) {
      console.error(LOG_PREFIX, 'Failed to build camera curve:', err);
      return;
    }
  }

  if (!runtime.cameraCurve) return;

  const shotDuration = Math.max(shot.time[1] - shot.time[0], 0.0001);
  const shotProgress = (runtime.currentTime - shot.time[0]) / shotDuration;
  let t = Math.max(0, Math.min(1, shotProgress));

  const tempoWarp = shot.camera && shot.camera.tempoWarp ? shot.camera.tempoWarp : 0;
  if (tempoWarp !== 0) {
    t += tempoState.wave * tempoWarp * 0.05 + tempoState.pulse * tempoWarp * 0.03;
    t = Math.max(0, Math.min(1, t));
  }

  const easedT = applyEasing(t, shot.camera && shot.camera.ease ? shot.camera.ease : 'smooth');
  const lookAheadT = Math.min(1, easedT + 0.04);

  try {
    const pos = runtime.cameraCurve.getPoint(easedT);
    runtime.camera.position.copy(pos);

    const oscillation = shot.camera.oscillation || 0;
    if (oscillation > 0) {
      runtime.cameraOscillationPhase += 0.08 + tempoState.pulse * 0.12;
      runtime.camera.position.x += Math.sin(runtime.cameraOscillationPhase * 2.3) * oscillation * 0.3;
      runtime.camera.position.y += Math.sin(runtime.cameraOscillationPhase * 3.1) * oscillation * 0.22;
      runtime.camera.position.z += Math.sin(runtime.cameraOscillationPhase * 1.7) * oscillation * 0.18;
    }

    const tempoShake = shot.camera && shot.camera.tempoShake ? shot.camera.tempoShake : 0;
    if (tempoShake > 0) {
      const jitter = (tempoState.pulse * 0.4 + tempoState.audioPulse * 0.5 + tempoState.accent * 0.6);
      runtime.camera.position.x += (Math.random() - 0.5) * tempoShake * jitter * 0.08;
      runtime.camera.position.y += (Math.random() - 0.5) * tempoShake * jitter * 0.08;
      runtime.camera.position.z += (Math.random() - 0.5) * tempoShake * jitter * 0.06;
    }

    const target = runtime.cameraCurve.getPoint(lookAheadT);
    runtime.camera.lookAt(target);

    const rollRange = shot.camera && shot.camera.rollDeg ? shot.camera.rollDeg : [0, 0];
    const roll = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(rollRange[0], rollRange[1], easedT));
    const accentRoll = shot.camera && shot.camera.accentRoll ? shot.camera.accentRoll : 0;
    const tempoRoll = shot.camera && shot.camera.tempoRoll ? shot.camera.tempoRoll : 0;
    const computedRoll = roll + tempoRoll * tempoState.pulse * 0.5 + accentRoll * tempoState.accent * 0.7;
    runtime.camera.rotation.z = computedRoll;

    const fovRange = shot.camera && shot.camera.fov ? shot.camera.fov : [60, 68];
    let fov = THREE.MathUtils.lerp(fovRange[0], fovRange[1], easedT);
    const tempoFov = shot.camera && shot.camera.tempoFov ? shot.camera.tempoFov : 0;
    if (tempoFov !== 0) {
      fov += tempoState.pulse * tempoFov * 0.4 + tempoState.audioPulse * tempoFov * 0.3;
    }
    runtime.camera.fov = THREE.MathUtils.clamp(fov, 32, 110);
    runtime.camera.updateProjectionMatrix();

    const tempoPush = shot.camera && shot.camera.tempoPush ? shot.camera.tempoPush : 0;
    const tempoLift = shot.camera && shot.camera.tempoLift ? shot.camera.tempoLift : 0;
    runtime.camera.position.addScaledVector(runtime.camera.getWorldDirection(new THREE.Vector3()), tempoPush * tempoState.pulse * 0.5);
    runtime.camera.position.y += tempoLift * (tempoState.audioPulse * 0.2 + tempoState.pulse * 0.15);
  } catch (err) {
    console.error(LOG_PREFIX, 'Camera update failed:', err);
  }
}

export function updateCityLights() {
  const shot = runtime.currentShot;
  const sparkle = shot && shot.fx ? (shot.fx.sparkle || 0) : 0;
  const pulse = tempoState.pulse;
  const accent = tempoState.accent;
  const audioPulse = tempoState.audioPulse;
  const energy = runtime.lastAudioEnergy;

  runtime.windowLights.forEach((mesh) => {
    if (!mesh.material || Array.isArray(mesh.material)) return;
    const base = mesh.userData && mesh.userData.base ? mesh.userData.base : 0.45;
    const flicker = mesh.userData && mesh.userData.flicker ? mesh.userData.flicker : 0.35;
    const target = base + (pulse * 0.7 + accent * 0.6 + energy * 0.8 + audioPulse * 0.6) * flicker * (0.7 + sparkle * 0.6);
    mesh.material.opacity = THREE.MathUtils.lerp(mesh.material.opacity, Math.min(1.0, target), 0.3);
  });

  runtime.accentLights.forEach((mesh) => {
    if (!mesh.material || Array.isArray(mesh.material)) return;
    const base = mesh.userData && mesh.userData.base ? mesh.userData.base : 0.3;
    const flicker = mesh.userData && mesh.userData.flicker ? mesh.userData.flicker : 0.25;
    const target = base + (pulse * 0.5 + energy * 0.6 + audioPulse * 0.5) * flicker;
    mesh.material.opacity = THREE.MathUtils.lerp(mesh.material.opacity, Math.min(1.0, target), 0.25);
  });

  runtime.underbridgeLights.forEach((mesh) => {
    if (!mesh.material || Array.isArray(mesh.material)) return;
    const base = mesh.userData && mesh.userData.base ? mesh.userData.base : 0.28;
    const flicker = mesh.userData && mesh.userData.flicker ? mesh.userData.flicker : 0.3;
    const target = base + (pulse * 0.8 + accent * 0.6 + energy * 0.5 + audioPulse * 0.5) * flicker;
    mesh.material.opacity = THREE.MathUtils.lerp(mesh.material.opacity, Math.min(1.0, target), 0.28);
  });
}

export function updateCinematicElements(deltaSeconds) {
  const pulse = tempoState.pulse;
  const accent = tempoState.accent;
  const audioPulse = tempoState.audioPulse;
  const energy = tempoState.energy;
  const time = runtime.currentTime;

  const camera = runtime.camera;
  if (camera) {
    runtime.skylineLayers.forEach((layer) => {
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

  if (runtime.moonMesh && runtime.moonMesh.material) {
    const base = runtime.moonMesh.userData && runtime.moonMesh.userData.baseOpacity ? runtime.moonMesh.userData.baseOpacity : 0.78;
    const target = base + (accent * 0.24 + audioPulse * 0.28 + energy * 0.22);
    runtime.moonMesh.material.opacity = THREE.MathUtils.lerp(runtime.moonMesh.material.opacity, Math.min(1.2, target), 0.12);
    runtime.moonMesh.rotation.z = Math.sin(time * 0.05) * 0.04;
  }

  runtime.godRayMeshes.forEach((mesh, index) => {
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

  if (runtime.starfield && runtime.starfield.material) {
    const base = runtime.starfield.userData && runtime.starfield.userData.baseOpacity ? runtime.starfield.userData.baseOpacity : 0.28;
    const target = base + (audioPulse * 0.18 + accent * 0.12);
    runtime.starfield.material.opacity = THREE.MathUtils.lerp(runtime.starfield.material.opacity, Math.min(0.8, target), 0.06);
    runtime.starfield.rotation.z += deltaSeconds * 0.08;
  }

  runtime.droneTrailMeshes.forEach((mesh) => {
    if (!mesh || !mesh.material) return;
    const base = mesh.userData && mesh.userData.baseOpacity ? mesh.userData.baseOpacity : 0.2;
    const offset = mesh.userData && mesh.userData.offset ? mesh.userData.offset : 0;
    const wave = mesh.userData && mesh.userData.wave ? mesh.userData.wave : 0.5;
    const osc = Math.sin(time * (1.4 + wave * 0.6) + offset) * 0.1;
    const target = base + osc + pulse * 0.18 + audioPulse * 0.24 + accent * 0.12;
    mesh.material.opacity = THREE.MathUtils.lerp(mesh.material.opacity, THREE.MathUtils.clamp(target, 0, 1), 0.12);
  });

  runtime.bridgeSearchLights.forEach((mesh) => {
    if (!mesh || !mesh.material) return;
    mesh.rotation.y += deltaSeconds * (mesh.userData && mesh.userData.speed ? mesh.userData.speed : 0.6);
    const base = mesh.userData && mesh.userData.baseOpacity ? mesh.userData.baseOpacity : 0.18;
    const target = base + pulse * 0.24 + audioPulse * 0.3 + energy * 0.18 + accent * 0.15;
    mesh.material.opacity = THREE.MathUtils.lerp(mesh.material.opacity, Math.min(0.9, target), 0.18);
  });

  if (runtime.scene && runtime.scene.fog) {
    const shot = runtime.currentShot;
    const hazeBase = shot && shot.fx && typeof shot.fx.haze === 'number' ? shot.fx.haze : BASE_FOG_DENSITY;
    const hazePulse = shot && shot.fx && shot.fx.hazePulse ? shot.fx.hazePulse : 0;
    const fogTarget = hazeBase + hazePulse * (tempoState.pulse + tempoState.accent * 0.5 + tempoState.audioPulse * 0.5);
    runtime.cityFogDensity = THREE.MathUtils.lerp(runtime.cityFogDensity, fogTarget, 0.05);
    runtime.scene.fog.density = runtime.cityFogDensity;
  }
}

export function updateExposureAndPost() {
  const shot = runtime.currentShot;
  if (!shot) return;

  const t = THREE.MathUtils.clamp((runtime.currentTime - shot.time[0]) / (Math.max(shot.time[1] - shot.time[0], 0.0001)), 0, 1);
  const audioEnergy = runtime.lastAudioEnergy;
  const combinedPulse = tempoState.pulse;
  const beatPulse = tempoState.beatPulse;
  const audioPulse = tempoState.audioPulse;
  const accent = tempoState.accent;

  if (shot.fx && shot.fx.bloom && runtime.bloomPass) {
    const bloomBase = THREE.MathUtils.lerp(shot.fx.bloom[0], shot.fx.bloom[1], t);
    const neon = shot.fx.neonPulse || 0;
    const bloomPulse = neon * (audioEnergy * 0.7 + combinedPulse * 0.45 + accent * 0.6 + Math.abs(tempoState.wave) * 0.2);
    runtime.bloomPass.strength = bloomBase + bloomPulse;
  }

  if (shot.fx && shot.fx.vignette && runtime.vignettePass && runtime.vignettePass.uniforms) {
    const vignetteVal = THREE.MathUtils.lerp(shot.fx.vignette[0], shot.fx.vignette[1], t);
    runtime.vignettePass.uniforms.uVignette.value = vignetteVal;
    runtime.vignettePass.uniforms.uTime.value = runtime.currentTime * (1.0 + (shot.fx.sparkle || 0) * 0.6);
    runtime.vignettePass.uniforms.uGrain.value = 0.16 + audioEnergy * 0.12 + (shot.fx.sparkle || 0) * 0.14 + beatPulse * 0.05;

    if (runtime.vignettePass.uniforms.uPulse) {
      runtime.vignettePass.uniforms.uPulse.value = combinedPulse;
    }
    if (runtime.vignettePass.uniforms.uAccent) {
      runtime.vignettePass.uniforms.uAccent.value = accent;
    }
    if (runtime.vignettePass.uniforms.uSparkle) {
      const sparkleTarget = (shot.fx.sparkle || 0) * (combinedPulse * 0.6 + accent * 0.7 + audioEnergy * 0.8 + audioPulse * 0.5 + Math.abs(tempoState.wave) * 0.3);
      runtime.vignettePass.uniforms.uSparkle.value = THREE.MathUtils.lerp(
        runtime.vignettePass.uniforms.uSparkle.value,
        sparkleTarget,
        0.2
      );
    }
  }

  const exposureBase = shot.fx && typeof shot.fx.exposure === 'number' ? shot.fx.exposure : 0.95;
  const flash = shot.fx && shot.fx.flash ? shot.fx.flash : 0;
  const accentFlash = shot.fx && shot.fx.accentFlash ? shot.fx.accentFlash : 0;
  runtime.baseExposure = Math.max(
    0.25,
    Math.min(1.8, exposureBase + flash * (combinedPulse + audioEnergy * 0.8) + accentFlash * accent)
  );
  if (runtime.renderer) {
    runtime.renderer.toneMappingExposure = runtime.baseExposure;
  }
}

import { LOG_PREFIX, TARGET_HEIGHT, TARGET_WIDTH } from './config.js';
import { runtime } from './state.js';
import { showStatus } from './status.js';

export function setupPostProcessing() {
  const width = TARGET_WIDTH;
  const height = TARGET_HEIGHT;

  if (!THREE.CopyShader) {
    console.warn(LOG_PREFIX, 'CopyShader missing, creating polyfill');
    THREE.CopyShader = {
      uniforms: { tDiffuse: { value: null }, opacity: { value: 1.0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform sampler2D tDiffuse; uniform float opacity; varying vec2 vUv; void main(){ vec4 c=texture2D(tDiffuse,vUv); gl_FragColor=vec4(c.rgb, c.a*opacity); }'
    };
  }

  runtime.composer = new THREE.EffectComposer(runtime.renderer);
  const renderPass = new THREE.RenderPass(runtime.scene, runtime.camera);
  runtime.composer.addPass(renderPass);
  console.log(LOG_PREFIX, 'Basic render pass created');

  try {
    if (!THREE.CopyShader) {
      throw new Error('CopyShader missing');
    }
    if (!THREE.LuminosityHighPassShader) {
      throw new Error('LuminosityHighPassShader missing');
    }

    runtime.bloomPass = new THREE.UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.45,
      0.8,
      0.85
    );
    runtime.composer.addPass(runtime.bloomPass);
    console.log(LOG_PREFIX, '✓ Bloom pass created');

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

    runtime.vignettePass = new THREE.ShaderPass(bwMaterial);
    runtime.vignettePass.renderToScreen = true;
    runtime.composer.addPass(runtime.vignettePass);
    console.log(LOG_PREFIX, '✓ B&W vignette pass created');

    console.log(LOG_PREFIX, '✓ Post-processing setup complete (full FX)');
  } catch (error) {
    console.warn(LOG_PREFIX, 'Post-FX disabled (safe mode):', error.message);
    renderPass.renderToScreen = true;
    showStatus('Post-FX disabled (safe mode)', 3000);
  }
}

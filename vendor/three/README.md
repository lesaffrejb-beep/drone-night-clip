# Three.js Vendor Files (v0.160.0)

This directory contains vendored Three.js library files to eliminate CDN dependencies.

## Files

- **three.min.js** (655KB) - Core Three.js library
- **Pass.js** - Base class for post-processing passes
- **EffectComposer.js** - Post-processing pipeline manager
- **RenderPass.js** - Basic render pass
- **ShaderPass.js** - Custom shader pass
- **UnrealBloomPass.js** - Bloom effect (Unreal Engine style)
- **CopyShader.js** - Simple copy shader
- **LuminosityHighPassShader.js** - High-pass filter for bloom

## Source

All files are from Three.js r160 (0.160.0):
- Downloaded from: https://github.com/mrdoob/three.js (tag: r160)
- License: MIT
- Repository: https://github.com/mrdoob/three.js

## Why Vendor?

1. **Zero CDN dependencies** - Works offline, in file:// mode, and on slow networks
2. **Guaranteed availability** - No external network failures
3. **Consistent versions** - Lock to specific Three.js version
4. **Faster loading** - No external DNS/HTTP overhead

## Updating

To update to a newer version of Three.js:

```bash
# Download new three.min.js
curl -L -o vendor/three/three.min.js \
  https://raw.githubusercontent.com/mrdoob/three.js/rXXX/build/three.min.js

# Verify other files are compatible
# (Pass.js, shaders, etc. rarely change between versions)
```

Replace `rXXX` with the desired version tag (e.g., `r165`).

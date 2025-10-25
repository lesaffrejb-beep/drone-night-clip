# Assets Directory

This directory is for optional assets like audio tracks and textures.

## Audio Track

To add custom audio to your animation:

1. Place your audio file here as `track.mp3` (or any format supported by the browser)
2. Use the "Load Audio" button in the UI to upload it at runtime

**OR**

Simply replace `assets/track.mp3` with your own track and reload the page.

### Recommended Audio Specs:
- **Format**: MP3, WAV, or OGG
- **BPM**: Match the scene's BPM (90 by default, configurable in scene.json)
- **Duration**: 18 seconds (or match scene.meta.duration)
- **Style**: Ambient, synthwave, downtempo electronic

## Textures (Optional)

You can add noise textures or other images here if you want to extend the project with custom shaders or backgrounds.

Example files you might add:
- `noise.png` - Film grain texture
- `gradient.png` - Background gradient
- `logo.png` - Watermark or branding

**Note**: The current implementation generates procedural noise in shaders, so texture files are not required for the base experience.

## Example Audio Sources

Free music resources compatible with this project:
- [Freesound.org](https://freesound.org) - Ambient loops
- [Incompetech](https://incompetech.com) - Royalty-free music
- [Purple Planet](https://www.purple-planet.com) - Atmospheric tracks

Remember to respect licensing terms when using third-party audio!

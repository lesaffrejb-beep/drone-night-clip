# 🌃 Drone Night POV

An immersive vertical (9:16) cinematic experience featuring a procedurally generated night city flythrough with audio-reactive visual effects. Built with Three.js and Canvas 2D fallback, designed for GitHub Pages.

## ✨ Features

- **Cinematic Camera Path**: Smooth CatmullRom curve following a pre-scripted drone flight
- **Procedural City**: Low-poly buildings with animated neon windows and atmospheric lighting
- **Post-Processing FX**: Bloom, vignette, and film grain effects that pulse with the audio
- **Audio Reactive**: Syncs visual effects to your music or falls back to beat timeline
- **25fps Recording**: Export your animation as a high-quality .webm video file
- **Responsive 9:16**: Perfect vertical format for mobile and social media
- **No Build Step**: Pure HTML/CSS/JS with CDN dependencies
- **WebGL + 2D Fallback**: Gracefully degrades to Canvas 2D if WebGL unavailable

## 🚀 Quick Start

### 1. Enable GitHub Pages

1. Go to your repository **Settings** → **Pages**
2. Under **Source**, select `main` branch and `/` (root) directory
3. Click **Save**
4. Your site will be live at: `https://<your-username>.github.io/drone-night-clip/`

### 2. View the Animation

Simply open the GitHub Pages URL in your browser. The animation will start loading automatically.

**Controls:**
- **SPACE**: Play/Pause
- **,** / **.**: Decrease/increase playback speed
- **H**: Toggle HUD (shows time, FPS, effects info)
- **R**: Restart from beginning

### 3. Add Custom Audio (Optional)

#### Option A: Runtime Upload
1. Open the page
2. Click **"Load Audio"** button
3. Select your audio file (MP3, WAV, OGG)

#### Option B: Static File
1. Place your audio file in the `assets/` directory as `track.mp3`
2. Modify `src/app.js` to auto-load it:
   ```javascript
   // Add after line ~200 (in setupAudio function):
   fetch('assets/track.mp3')
     .then(res => res.blob())
     .then(blob => setupAudio(blob));
   ```

**Audio Tips:**
- Match the scene's BPM (default 90) for better sync
- Duration should match `scene.json` duration (18 seconds)
- Ambient/downtempo electronic works best

### 4. Try Different Presets

Use the **Preset** dropdown in the UI to switch between:
- **Default**: Balanced (scene.json)
- **Soft**: Gentle camera movement, subtle FX (presets/soft.json)
- **Intense**: Fast-paced, strong bloom, dramatic roll (presets/intense.json)
- **Very Dark**: Slow, heavy vignette, minimal lighting (presets/dark.json)

## 🎬 Recording Your Animation

1. Click **"⏺ Record 25fps"** button
2. The animation will restart and begin recording
3. Wait for the full duration to complete
4. Click **"⏹ Stop Recording"** or let it finish automatically
5. The video file (`drone-night-clip-XXXXX.webm`) will download automatically

**Recording Notes:**
- Frame rate is locked to 25fps for smooth export
- Output resolution matches your canvas size (scales to fit 9:16 aspect ratio)
- For best quality, use fullscreen mode before recording
- Typical file size: ~5-15 MB for 18 seconds

## ⚙️ Customization

### Editing the Scene

All scene configuration is in `scene.json`:

```json
{
  "meta": {
    "title": "Drone Night POV",
    "duration": 18,        // Total duration in seconds
    "bpm": 90,             // Beats per minute (for beat detection)
    "seed": 42             // Random seed for city generation
  },
  "beats": [...],          // Timeline of beat moments
  "shots": [...]           // Camera path segments with FX config
}
```

#### Shot Structure:
- **time**: `[start, end]` in seconds
- **path.points**: Array of `[x, y, z]` coordinates for CatmullRom curve
- **camera.fov**: `[start, end]` field of view (degrees)
- **camera.rollDeg**: `[start, end]` camera roll angle
- **camera.speedMul**: Speed multiplier for this segment
- **fx.bloom**: `[start, end]` bloom intensity
- **fx.vignette**: `[start, end]` vignette strength
- **fx.neonPulse**: Audio reactivity multiplier
- **fx.fade**: Optional `[start, end]` for fade-to-black

### Creating Custom Presets

1. Copy `scene.json` to `presets/your-preset.json`
2. Modify the values (camera path, FX, timing, etc.)
3. Add it to the dropdown in `index.html`:
   ```html
   <option value="presets/your-preset.json">Your Preset</option>
   ```

### Changing the City

The city is procedurally generated in `src/app.js` (function `setupCity()`):
- Modify `gridSize` and `blockSize` for city density
- Adjust building `height` ranges for skyline variation
- Change `seed` in `scene.json` for different layouts
- Tweak neon colors by editing the `color` values

### Adjusting Post-Processing

In `src/app.js` (function `setupPostProcessing()`):

```javascript
bloomPass = new THREE.UnrealBloomPass(
  new THREE.Vector2(width, height),
  0.3,  // Bloom strength
  0.4,  // Bloom radius
  0.85  // Threshold (higher = less bloom)
);
```

Vignette and grain are controlled in the custom shader uniforms.

## 📁 Project Structure

```
/
├── index.html           # Main page with UI and CDN scripts
├── scene.json           # Default scene configuration
├── src/
│   ├── app.js           # Three.js renderer (main logic)
│   └── fallback2d.js    # Canvas 2D fallback renderer
├── assets/
│   └── README.md        # Audio and texture instructions
├── presets/
│   ├── soft.json        # Gentle preset
│   ├── intense.json     # Energetic preset
│   └── dark.json        # Moody preset
└── README.md            # This file
```

## 🛠️ Development

### Local Testing

No build step required! Just open `index.html` in a browser:

```bash
# Simple HTTP server (Python 3)
python -m http.server 8000

# Or with Node.js
npx http-server -p 8000
```

Then visit `http://localhost:8000`

### Browser Compatibility

**Recommended**: Chrome, Edge, Firefox, Safari (latest versions)

- **WebGL Required**: For full Three.js experience
- **Fallback Available**: Canvas 2D version for older browsers
- **Recording Requires**: MediaRecorder API support (Chrome/Firefox/Edge)

### Performance Tips

- Lower resolution by zooming out before running
- Close other tabs/applications
- Use hardware acceleration in browser settings
- Recording at 25fps is less demanding than 60fps playback

## 🎨 Visual Style

The project aims for a **digital art / night / mystery** aesthetic:

- **Color Palette**: Blacks, dark blues, cyan accents (#00ffff), warm amber (#ffaa44)
- **Lighting**: Minimal ambient, subtle neon glow, atmospheric fog
- **Effects**: Film grain, heavy vignette, selective bloom on neon elements
- **Composition**: Low-angle urban canyon, bridge underpass, architectural framing

Inspiration: Blade Runner, Ghost in the Shell, cyberpunk night photography

## 🐛 Troubleshooting

### "WebGL not supported" message
- Use a modern browser (Chrome/Firefox/Edge)
- Enable hardware acceleration in browser settings
- Falls back to 2D Canvas automatically

### Audio not syncing
- Check that audio file duration matches scene duration
- Verify BPM in `scene.json` matches your track
- Try the "Load Audio" button instead of static file

### Recording produces black video
- Ensure you clicked "Record" BEFORE playing
- Check browser console for errors
- Try a different browser (Chrome recommended for recording)

### Low frame rate during playback
- Reduce browser window size
- Close other applications
- Lower bloom quality in `setupPostProcessing()`

### Scene looks too dark/bright
- Adjust `renderer.toneMappingExposure` in `src/app.js`
- Modify preset FX values (bloom, vignette)
- Change fog density in `setupScene()`

## 📄 License

This project is open source and available under the MIT License.

Feel free to fork, modify, and use for your own creative projects!

## 🙏 Credits

- **Three.js**: 3D rendering library (https://threejs.org)
- **Unpkg CDN**: For hosting Three.js dependencies
- **Inspiration**: Cyberpunk aesthetics, drone cinematography, synthwave culture

---

**Made with Claude Code** 🤖

For questions or improvements, please open an issue on GitHub!

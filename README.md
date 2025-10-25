# 🌃 Drone Night POV

An immersive vertical (9:16) cinematic experience featuring a procedurally generated night city flythrough with audio-reactive visual effects. Built with Three.js and Canvas 2D fallback, designed for GitHub Pages.

**NEW**: Works seamlessly in local file:// mode with embedded scene data - no server required!

## ✨ Features

### Visual Effects
- **Enhanced Post-Processing**: Bloom, vignette, film grain, and chromatic aberration
- **Camera Micro-Oscillation**: Handheld feel with subtle shake on intense presets
- **Rhythmic Jitter**: Camera pulses on beat hits for dynamic energy
- **Teal & Amber Color Grade**: Cinematic color treatment with enhanced contrast
- **Audio-Reactive FX**: Bass-driven bloom and grain that sync with your music

### Camera & Animation
- **Cinematic Camera Path**: Smooth CatmullRom curve with 3 distinct shots
- **Dynamic FOV & Roll**: Interpolated field of view (55°-95°) and camera roll (up to 10° in INSANE mode)
- **Speed Variation**: Camera speed multipliers per shot for dramatic pacing
- **Beat-Synced Motion**: Subtle jitter on musical beats

### Technical
- **Procedural City**: Low-poly buildings with animated neon windows (cyan/amber palette)
- **25fps Recording**: Export as high-quality .webm video (10 Mbps bitrate)
- **Responsive 9:16**: Perfect vertical format optimized for mobile/social
- **No Build Step**: Pure HTML/CSS/JS with CDN dependencies
- **WebGL + 2D Fallback**: Gracefully degrades to Canvas 2D if WebGL unavailable
- **Local File Mode**: Embedded scene data works with `file://` protocol
- **5 Presets**: Default, Soft, Intense, Very Dark, and INSANE modes

## 🚀 Quick Start

### Option A: Local File Mode (No Server)

**Just downloaded the repo? It works instantly!**

1. Open `index.html` directly in your browser (double-click or drag-and-drop)
2. You'll see a small "📁 Local mode (inline scene)" indicator
3. All features work except external file loading
4. All 5 presets are embedded and fully functional

**Note**: This mode uses embedded scene data. For the best experience and external preset loading, use Option B or C.

### Option B: GitHub Pages (Recommended)

1. Go to your repository **Settings** → **Pages**
2. Under **Source**, select `main` branch and `/` (root) directory
3. Click **Save**
4. Your site will be live at: `https://<your-username>.github.io/drone-night-clip/`

### Option C: Local Server

For local development with full file access:

```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server -p 8000
```

Then visit `http://localhost:8000`

### Controls

Once running:

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
- **Default**: Balanced (scene.json) - BPM 90, 18s
- **Soft**: Gentle camera, subtle FX (BPM 75, roll ±1°)
- **Intense**: Fast-paced, strong bloom, dramatic roll (BPM 120, roll ±5°)
- **Very Dark**: Slow, heavy vignette, minimal lighting (BPM 60)
- **INSANE**: Extreme speed, FOV 62°→95°, roll up to 10°, chromatic aberration (BPM 140, 20s)

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

**Three ways to run locally:**

1. **Direct file:// (easiest)**: Just open `index.html` - all features work with embedded scenes
2. **Python server**: `python -m http.server 8000` then visit `http://localhost:8000`
3. **Node server**: `npx http-server -p 8000` then visit `http://localhost:8000`

### How File Mode Works

When opened via `file://` protocol:
- Automatic detection of local mode
- Falls back to embedded `<script type="application/json">` scene data
- All 5 presets work seamlessly
- Small indicator appears: "📁 Local mode (inline scene)"
- No network requests, works 100% offline

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

### Page won't load / Fetch errors
**Solution**: Open directly via `file://` - the page auto-detects and uses embedded scenes. Or serve via HTTP as described above.

### "WebGL not supported" message
- Use a modern browser (Chrome/Firefox/Edge)
- Enable hardware acceleration in browser settings
- Falls back to 2D Canvas automatically

### Audio not syncing
- Check that audio file duration matches scene duration (18s default, 20s for INSANE)
- Verify BPM in `scene.json` matches your track
- Audio analysis focuses on bass frequencies (0-100Hz)

### Recording produces black video
- Ensure you clicked "Record" BEFORE playing
- Check browser console for errors
- Try Chrome (best MediaRecorder support)

### Low frame rate during playback
- Reduce browser window size
- Close other tabs/applications
- Try a less demanding preset (Soft or Default)
- INSANE preset is GPU-intensive (FOV up to 95°, heavy chromatic aberration)

### Scene looks too dark/bright/oversaturated
- Try different presets (Dark has heavy vignette, Intense has strong bloom)
- Adjust `renderer.toneMappingExposure` in `src/app.js` (default 1.3)
- Modify color grade in the fragment shader (lines 437-439 in app.js)

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

# 🌃 Drone Night POV - V2 B&W Edition

**Cinematic B&W Animation** - Pure monochrome drone POV short film. Designed for GitHub Pages deployment with anti-fragile architecture.

## ✨ V2 Features

### Anti-Fragile Design
- **Zero CDN Dependencies**: All Three.js files vendored locally (~690KB)
- **Works Offline**: Loads instantly from vendor/ directory
- **Auto 2D Fallback**: Switches to Canvas 2D if WebGL unavailable
- **Inline JSON Fallback**: Embedded scene data if fetch fails
- **No Audio Required**: Beat timeline fallback, visuals work without audio
- **Never Crashes**: Defensive null checks everywhere
- **[DRONE] Logging**: Full console diagnostics for debugging
- **Two-Phase Init**: UI always loads, even if scene data fails

### Visual Style
- **Pure Monochrome**: Black (#000) to Ivory (#eee) only
- **Strong Vignette**: Cinematic edge darkening
- **Film Grain**: Subtle texture animation
- **Subtle Bloom**: Avoids "milky" look
- **High Contrast**: B&W optimized shader

### Camera
- **3 Shots**: Survol → Plongée → SousPont
- **CatmullRom Paths**: Smooth interpolation
- **Dynamic FOV**: 55° to 74° (95° in Insane mode)
- **Camera Roll**: ±3° (±10° in Insane mode)
- **Beat Jitter**: Rhythmic micro-shake

### Recording
- **25fps Locked**: Canvas.captureStream(25)
- **10 Mbps**: High quality .webm export
- **Auto-restart**: Begins from t=0

## 🚀 Quick Start

### 1. File Mode (Simplest - Works Offline!)

**Just open the file** - No server needed!

```bash
# macOS
open index.html

# Windows
start index.html

# Linux
xdg-open index.html
```

✅ Works instantly with vendored Three.js files
✅ No network required
✅ Full 3D rendering
✅ Auto-loads 2D fallback if WebGL unavailable

**Note:** Presets require HTTP server. Default scene works in file:// mode.

### 2. GitHub Pages (Production)

**Live Demo**: `https://lesaffrejb-beep.github.io/drone-night-clip/`

**Deploy Your Own:**
1. Push to **`main`** branch
2. Go to repo **Settings** → **Pages**
3. Source: `main` branch, `/` root
4. Save and wait ~1 minute
5. Visit: `https://<your-username>.github.io/drone-night-clip/`

✅ Instant loading (no CDN delays)
✅ Works on slow networks
✅ Full functionality (audio, presets, recording)

### 3. Local Development Server (Best for Presets)

```bash
# Python 3 (Simple & Universal)
python3 -m http.server 8000
# Then visit: http://localhost:8000

# VS Code Live Server
# Install "Live Server" extension
# Right-click index.html → "Open with Live Server"

# Node.js
npx http-server -p 8000
```

✅ All presets work (insane.json, dark.json, etc.)
✅ Fast iteration
✅ Audio files loadable

## 🎵 Audio Files (Optional)

Add your own audio track:

```bash
# Place audio in assets/
cp your-track.mp3 assets/track.mp3
```

Or use the **Load Audio** button in the UI to upload any audio file.

## 🎮 Controls

### Splash Screen
- **▶ Start**: Begin playback
- **Load Audio**: Upload MP3/WAV/OGG
- **Preset Dropdown**: Switch scenes

### Keyboard (after Start)
- **SPACE**: Play/Pause
- **H**: Toggle HUD
- **,** / **.**: Speed -/+ (0.5x to 2.0x)
- **R**: Restart
- **Shift+S**: Screenshot (PNG)

## 🎥 Recording

1. Load the page (GitHub Pages or local server)
2. Click **"▶ Start Experience"** button
3. Video automatically records from start to finish (18-20s)
4. Recording stops at end, download starts automatically
5. File saves as `.webm` in your Downloads folder

**Convert WebM to MP4:**

```bash
# High quality (recommended)
ffmpeg -i drone-night-*.webm -c:v libx264 -crf 18 -preset slow output.mp4

# Fast conversion
ffmpeg -i drone-night-*.webm -c:v libx264 -crf 23 -preset fast output.mp4

# For social media (1080p)
ffmpeg -i drone-night-*.webm -c:v libx264 -vf "scale=1080:1920" -crf 23 output.mp4
```

**Notes:**
- Recording always runs at 25fps (locked framerate for smooth playback)
- Output file size: ~5-10MB for 20 seconds
- Chrome recommended (best MediaRecorder codec support)
- Original resolution: 1080x1920 (vertical 9:16)

## 🎨 Presets

| Preset | Duration | BPM | FOV | Roll | Vignette | Feel |
|--------|----------|-----|-----|------|----------|------|
| **Default** | 18s | 90 | 55°-74° | ±3° | 0.25-0.60 | Balanced |
| **Insane** | 20s | 140 | 62°-95° | ±10° | 0.30-0.70 | Aggressive |

## 🛠️ Customization

### scene.json Structure

```json
{
  "meta": {
    "title": "Scene Name",
    "duration": 18,
    "bpm": 90,
    "seed": 42
  },
  "beats": [0, 0.67, 1.33, ...],
  "shots": [
    {
      "name": "Shot Name",
      "time": [start, end],
      "path": {
        "type": "catmullrom",
        "points": [[x,y,z], ...]
      },
      "camera": {
        "fov": [start, end],
        "rollDeg": [start, end],
        "speedMul": 1.0,
        "oscillation": 0.0
      },
      "fx": {
        "bloom": [start, end],
        "vignette": [start, end],
        "neonPulse": 0.1,
        "fade": [start, end]
      }
    }
  ]
}
```

### Add Custom Preset

1. Create `presets/my-preset.json`
2. Edit `index.html` line 291:
   ```html
   <option value="my-preset">My Preset</option>
   ```
3. Update `src/app.js` line 883 preset loader

## 🧪 Troubleshooting

### "Local Mode Detected" Error

**Cause**: Opening `index.html` directly from file system (file:// protocol) won't load CDN scripts.

**Solutions**:
1. **Use GitHub Pages** (recommended): Push to `main` branch, enable Pages in repo settings
2. **Run local server**: `python3 -m http.server 8000` → visit `http://localhost:8000`
3. **VS Code Live Server**: Install extension, right-click index.html → Open with Live Server

### Infinite Loading

**FIXED:** No longer possible with vendored files!

If you still see loading:
1. **Check console (F12)** - Look for [DRONE] logs
2. **Verify vendor files** - Ensure vendor/three/*.js files exist
3. **Clear cache** - Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)

### Play Button Does Nothing

- **Fixed in V2!** Two-phase init ensures UI always connects
- Check console for `[DRONE]` logs (F12 → Console tab)
- Verify Three.js loaded: type `THREE` in console, should show object

### Black Screen

- **Check WebGL support**: Visit `https://get.webgl.org/`
- **Try Chrome/Firefox** (latest versions recommended)
- **Check console** for `[DRONE]` error logs
- **Fallback**: 2D Canvas should auto-activate if WebGL unavailable

### Audio Desync

- Reload page and try again
- Check audio duration roughly matches scene duration (18-20s)
- Try different audio format (MP3 recommended)
- Use browser's native audio player to verify file isn't corrupt

### Recording Failed

- **Best browser**: Chrome (best MediaRecorder support)
- **Check disk space** (needs ~50MB for 20s video)
- **Try shorter scene** (< 30s recommended)
- **Check permissions**: Browser may block downloads folder access

## 📊 Technical Details

### Vendor Architecture (Zero CDN)

All Three.js dependencies are vendored locally in `vendor/three/`:

| File | Size | Purpose |
|------|------|---------|
| three.min.js | 655KB | Core Three.js r160 library |
| Pass.js | 1.6KB | Base class for post-processing |
| EffectComposer.js | 4.3KB | Post-processing pipeline |
| RenderPass.js | 1.7KB | Basic scene render pass |
| ShaderPass.js | 1.5KB | Custom shader pass |
| UnrealBloomPass.js | 12KB | Bloom effect (Unreal style) |
| CopyShader.js | 619B | Simple copy shader |
| LuminosityHighPassShader.js | 1.2KB | High-pass filter for bloom |

**Total:** ~690KB (minified, loads instantly from local disk)

**Benefits:**
- ✅ Works offline and in file:// mode
- ✅ No network failures
- ✅ Instant loading (no CDN DNS/HTTP overhead)
- ✅ Version locked (r160)

### B&W Shader
- **Luminance conversion**: `dot(rgb, vec3(0.299, 0.587, 0.114))`
- **Grain**: Temporal + spatial noise
- **Vignette**: Smoothstep radial gradient
- **Contrast**: `(color - 0.5) * 1.2 + 0.5`

### Performance
- **Target**: 60 FPS playback, 25 FPS recording
- **Instancing**: Shared geometries for windows
- **Culling**: Fog hides distant objects
- **No allocations**: Reused buffers in render loop

### Failsafes (Anti-Fragile Stack)
1. **Vendor files**: Local Three.js → no network dependency
2. **2D fallback**: Auto-loads if WebGL unavailable (fallback2d.js)
3. **Inline scene**: Embedded in `<script id="scene-inline">`
4. **Emergency scene**: Hardcoded minimal flight in app.js
5. **Render loop**: Always runs, never blocks
6. **UI**: Setup before data load
7. **Audio**: Optional, never required

## 🔧 Troubleshooting

### Stuck at "Loading scene..."

**Expected Console Logs:**
```
[DRONE] ✓ All vendor files loaded successfully
[DRONE] WebGL available
[DRONE] Core systems initialized
[DRONE] ✓ Loaded scene.json
[DRONE] Finishing init...
[DRONE] ✓ City setup complete
[DRONE] ✓ Bridge setup complete
[DRONE] ✓ Post-processing setup complete
[DRONE] ✓ Render loop started
[DRONE] ✓ Initialization complete
```

**If stuck:**
1. Open browser DevTools (F12) → Console tab
2. Look for error messages starting with `[DRONE]`
3. Check which step failed (city, bridge, or post-processing)
4. If "Init error: Cannot read properties..." → vendor file missing or corrupted
5. Clear cache and refresh (Ctrl+Shift+R / Cmd+Shift+R)

### Convert .webm to .mp4

The app exports `.webm` files. To convert to MP4 for wider compatibility:

```bash
# Basic conversion
ffmpeg -i drone-night-clip-2025-10-27-123045.webm -c:v libx264 -crf 18 -pix_fmt yuv420p output.mp4

# High quality (slower)
ffmpeg -i drone-night-clip-*.webm -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p output.mp4

# Instagram/Social (1080x1920, 9:16)
ffmpeg -i drone-night-clip-*.webm -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p output-instagram.mp4
```

### Preset "Insane" Not Loading

If the Insane preset fails to load:
- The app automatically falls back to the default scene
- You'll see: "⚠ Preset unavailable, using default"
- Check browser console for fetch errors
- Verify `presets/insane.json` exists in your deployment

### No Audio

Audio is **optional**. The animation uses beat timeline fallback if no audio is loaded:
- Visual timing works without audio
- BPM from scene.json drives beat jitter
- "Load Audio" button lets you add your own track

### Performance Issues

If FPS drops below 30:
- Press `H` to hide HUD (reduces draw calls)
- Close other browser tabs
- Try Firefox/Chrome instead of Safari
- Disable browser extensions
- Reduce window size

### Recording Issues

If recording doesn't download:
- Check browser permissions for downloads
- Try Chrome/Edge (best MediaRecorder support)
- Check available disk space
- Recording auto-stops at scene end (18-20s)

## 📄 License

MIT License - Free to use, modify, distribute.

## 🙏 Credits

- **Three.js**: 3D library
- **Unpkg CDN**: Dependency hosting
- **Design**: Inspired by noir photography & puzzle aesthetics

---

**Made with Claude Code** 🤖

For issues: Check console `[DRONE]` logs → Open GitHub issue with details

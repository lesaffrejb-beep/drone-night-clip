# 🌃 Drone Night POV - V2 B&W Edition

**Cinematic B&W Animation** - Pure monochrome drone POV short film. Designed for GitHub Pages deployment with anti-fragile architecture.

## ✨ V2 Features

### Anti-Fragile Design
- **Smart Protocol Detection**: file:// shows helpful error immediately, https:// waits 30s
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

### 1. GitHub Pages (Recommended)

**Live Demo**: `https://lesaffrejb-beep.github.io/drone-night-clip/`

**Deploy Your Own:**
1. Go to repo **Settings** → **Pages**
2. Source: `main` branch, `/` root
3. Save
4. Wait ~1 minute
5. Visit: `https://<your-username>.github.io/drone-night-clip/`

✅ CDN loads properly over https://
✅ No "Local Mode" errors
✅ Full functionality (audio, presets, recording)

### 2. Local Development Server

**Required for local testing** (file:// won't load CDN scripts)

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

✅ Proper CDN loading
✅ All features work
✅ Fast iteration

### 3. Audio Files (Optional)

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

### Infinite Loading / CDN Timeout

**Cause**: Network blocking CDN, or very slow connection.

**Solutions**:
1. **Refresh the page** - sometimes CDN needs retry
2. **Check network** - ensure you can access unpkg.com
3. **Use GitHub Pages** - better CDN reliability on https://
4. **Wait up to 30 seconds** - production timeout is extended for slow networks

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

### Failsafes
1. **Inline scene**: Embedded in `<script id="scene-inline">`
2. **Emergency scene**: Hardcoded minimal flight
3. **Render loop**: Always runs, never blocks
4. **UI**: Setup before data load
5. **Audio**: Optional, never required

## 📄 License

MIT License - Free to use, modify, distribute.

## 🙏 Credits

- **Three.js**: 3D library
- **Unpkg CDN**: Dependency hosting
- **Design**: Inspired by noir photography & puzzle aesthetics

---

**Made with Claude Code** 🤖

For issues: Check console `[DRONE]` logs → Open GitHub issue with details

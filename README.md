# 🌃 Drone Night POV - V2 B&W Edition

**Anti-Fragile** monochrome cinematic experience. Works everywhere: file://, GitHub Pages, or local server. Play button ALWAYS works.

## ✨ V2 Features

### Anti-Fragile Design
- **File:// Support**: Works by double-clicking index.html
- **No Fetch Required**: Inline JSON fallback
- **No Audio Required**: Beat timeline fallback
- **Never Crashes**: Defensive checks everywhere
- **[DRONE] Logging**: Full console diagnostics

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

### 1. Local File Mode (Instant)
**No server needed!**

```bash
# Just open the file
open index.html  # macOS
start index.html # Windows
xdg-open index.html # Linux
```

✓ Works immediately with embedded scene data

### 2. GitHub Pages

1. Go to repo **Settings** → **Pages**
2. Source: `main` branch, `/` root
3. Save
4. URL: `https://<username>.github.io/drone-night-clip/`

### 3. Local Server (Best Dev Experience)

```bash
# Python 3
python3 -m http.server 8000

# VS Code
# Install "Live Server" extension, right-click index.html → Open with Live Server

# Node.js
npx http-server -p 8000
```

Then visit `http://localhost:8000`

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

1. Click **"▶ Start"** to initialize
2. Press **SPACE** or wait for auto-play
3. To record: Reload page, click Start, press SPACE immediately
4. Video saves as `.webm` in Downloads

**Convert to MP4:**
```bash
ffmpeg -i drone-night-*.webm -c:v libx264 -crf 18 -preset slow output.mp4
```

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

### Play button does nothing
- **Fixed in V2!** Init is two-phase, UI always connects
- Check console for `[DRONE]` logs
- Press F12, look for errors

### Black screen
- Check WebGL support: Visit `https://get.webgl.org/`
- Try Chrome/Firefox (latest versions)
- 2D fallback should auto-activate

### File:// mode: Presets don't load
- Expected behavior - presets require HTTP
- Use inline scene (auto-selected)
- Or serve via local server

### Audio desync
- Reload page and try again
- Check audio file duration matches scene
- Try different audio file

### Recording failed
- Chrome works best (MediaRecorder support)
- Check disk space
- Try shorter scene (< 30s)

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

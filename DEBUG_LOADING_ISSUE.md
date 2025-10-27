# Debugging "Loading scene..." Infinite Loop

## What I've Done

### 1. Added Extensive Logging (Commit 2272de1)
Modified `src/app.js` finishInit() function with detailed console logging:
- Logs each step: city setup, bridge setup, post-processing, render loop
- Logs UI updates: spinner hide, status change, button visibility
- Added try/catch to show errors to user
- Even on error, attempts to show Start button

### 2. Verified All Files
✅ All vendor files present and correct:
- three.min.js (655KB)
- Pass.js (with FullScreenQuad)
- EffectComposer.js
- RenderPass.js
- ShaderPass.js
- UnrealBloomPass.js
- CopyShader.js
- LuminosityHighPassShader.js

✅ Script loading order is correct (Pass.js before others)

✅ All HTML elements exist with correct IDs:
- #init-spinner
- #init-status
- #splash-buttons
- #splash-controls

✅ Dependency checker in index.html waits for all THREE.js classes before loading app.js

### 3. Pushed Changes
All debugging code is now on branch: `claude/drone-night-clip-setup-011CUTT6Cgh6zx5Jenf6PeMX`

## Next Steps for You

### Step 1: Merge to Main
```bash
# Create PR or merge directly
gh pr create --base main --head claude/drone-night-clip-setup-011CUTT6Cgh6zx5Jenf6PeMX \
  --title "debug: Add extensive logging for loading hang" \
  --body "Diagnoses the 'Loading scene...' infinite loop issue"

# OR merge locally:
git checkout main
git merge claude/drone-night-clip-setup-011CUTT6Cgh6zx5Jenf6PeMX
git push origin main
```

### Step 2: Wait for GitHub Pages
GitHub Pages takes 1-3 minutes to rebuild after pushing to main.

### Step 3: Test and Check Console
1. Open your GitHub Pages site in a browser
2. Open browser DevTools (F12)
3. Go to Console tab
4. Refresh the page
5. **Look for these console messages:**

#### Expected Success Flow:
```
[DRONE] ✓ All vendor files loaded successfully
[DRONE] WebGL available
[DRONE] Core systems initialized
[DRONE] Scene data loaded
[DRONE] Finishing init...
[DRONE] Setting up city with seed: 42
[DRONE] ✓ City setup complete
[DRONE] Setting up bridge...
[DRONE] ✓ Bridge setup complete
[DRONE] Setting up post-processing...
[DRONE] ✓ Post-processing setup complete
[DRONE] ✓ Render loop started
[DRONE] Showing UI controls...
[DRONE] ✓ Spinner hidden
[DRONE] ✓ Status updated to Ready
[DRONE] ✓ Start button visible
[DRONE] ✓ Controls visible
[DRONE] ✓ Initialization complete, render loop started
```

#### If It Fails:
The console will show:
- **Which step failed** (city, bridge, or post-processing)
- **Error message** showing what went wrong
- **Error stack trace** for debugging

### Step 4: Report Back
Copy the **entire console output** and send it back to me. I'll be able to pinpoint the exact line causing the hang.

## Suspected Issues (If Any)

Based on my investigation, possible failure points:
1. **setupPostProcessing()** - Creating UnrealBloomPass or ShaderPass might fail
2. **setupCity()** - Geometry creation might fail on some GPUs
3. **setupBridge()** - Mesh creation might fail
4. **Browser compatibility** - Old browser might not support Promise.finally()

The logging will tell us exactly which one it is.

## Quick Test (Local)
If you want to test locally before GitHub Pages:
```bash
python3 -m http.server 8001
# Open http://localhost:8001 in browser
# Check console
```

## Browser Compatibility Note
If you're testing on an old browser, try Chrome/Firefox/Edge (latest versions).
Safari should work but might show different errors.

---

**Status**: Debugging code is ready and pushed to claude branch.
**Action Required**: Merge to main, wait for GitHub Pages rebuild, check console, report back.

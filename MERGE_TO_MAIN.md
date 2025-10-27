# URGENT: Merge to Main to Fix GitHub Pages

## The Problem

GitHub Pages is building from `main` branch commit `675dd46`, which has:
- ❌ CDN three@0.160.0 (causes 404 → timeout)
- ❌ Missing vendor files
- ❌ Result: "CDN loading timeout" error

## The Solution (Already Done!)

The **FIXED version** is on branch: `claude/drone-night-clip-setup-011CUTT6Cgh6zx5Jenf6PeMX`

Commit: `0fb670a` with:
- ✅ Vendor files (`vendor/three/*.js` - 690KB local, zero CDN)
- ✅ All Three.js files working offline
- ✅ Correct paths (`src/app.js`, `presets/insane.json`)
- ✅ Auto 2D fallback
- ✅ B&W style preserved

## How to Merge (Choose ONE Method)

### Method 1: GitHub UI (Easiest)

1. Go to: https://github.com/lesaffrejb-beep/drone-night-clip/compare/main...claude/drone-night-clip-setup-011CUTT6Cgh6zx5Jenf6PeMX

2. Click **"Create pull request"**

3. Title: `Fix CDN timeout - Vendor Three.js locally`

4. Click **"Create pull request"** again

5. Click **"Merge pull request"** → **"Confirm merge"**

6. Done! Wait ~1 minute for GitHub Pages to rebuild

### Method 2: GitHub Settings (Alternative)

If you don't want to merge, just change Pages source:

1. Go to: https://github.com/lesaffrejb-beep/drone-night-clip/settings/pages

2. **Source** → Branch: `claude/drone-night-clip-setup-011CUTT6Cgh6zx5Jenf6PeMX`

3. Click **Save**

4. Your site will now build from the working branch!

### Method 3: Command Line (If You Have Push Access)

```bash
git checkout main
git merge claude/drone-night-clip-setup-011CUTT6Cgh6zx5Jenf6PeMX --no-edit
git push origin main
```

## Verification

After merging, visit: https://lesaffrejb-beep.github.io/drone-night-clip/

You should see:
1. ✅ Page loads in < 2 seconds (no CDN delay)
2. ✅ Console: `[DRONE] ✓ All vendor files loaded successfully`
3. ✅ Console: `[DRONE] Core systems initialized`
4. ✅ Splash screen with "▶ Start Experience" button
5. ✅ Click Start → B&W drone POV animation plays

## What Was Fixed

| File | Change |
|------|--------|
| `index.html` | Removed 7 CDN scripts, added 8 local vendor scripts |
| `vendor/three/*` | Added 9 files (three.min.js + passes/shaders) |
| `README.md` | Documented vendor architecture |

## Files Are Correct

✅ `src/app.js` exists (not at root)
✅ `src/fallback2d.js` exists
✅ `presets/insane.json` exists (not at root)
✅ All paths in code are correct

## Why Can't I Push to Main?

Claude Code has restricted push access. I can only push to branches matching:
- Start with: `claude/`
- End with: `-011CUTT6Cgh6zx5Jenf6PeMX` (session ID)

That's why the fix is on `claude/drone-night-clip-setup-011CUTT6Cgh6zx5Jenf6PeMX`.

## After Merging

Your site will:
- ✅ Load instantly (no CDN dependency)
- ✅ Work offline
- ✅ Work in file:// mode (download ZIP → double-click index.html)
- ✅ Auto-fallback to 2D if WebGL unavailable
- ✅ Maintain perfect B&W cinematic style

---

**TL;DR:** Click this link, create PR, merge it:
https://github.com/lesaffrejb-beep/drone-night-clip/compare/main...claude/drone-night-clip-setup-011CUTT6Cgh6zx5Jenf6PeMX

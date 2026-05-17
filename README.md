# HoloHDR

HoloHDR is a mobile-first browser tool for tuning SDR images into brighter HDR-style exports with gain-map controls inspired by the LXE ComfyUI Ultra HDR node.

The app is designed around phone use: load an image from the camera roll, preview the adjusted result, compare against the original by holding the image, tune with compact bottom controls, save custom presets, and export the result.

## Features

- Local image loading from the browser, including iPhone Safari.
- Fixed mobile workspace with a scrollable bottom tool rail.
- HDR, SDR, and gain-mask preview modes.
- Manual controls for exposure, contrast, shadows, highlights, SDR color, HDR color, headroom, threshold, softness, power, and gain-map gamma.
- Wand menu with browser-side automatic tuning passes.
- Saved presets stored locally in the browser.
- JPEG, gain-mask, and Ultra HDR exports directly in the browser.

## Run Locally

```bash
/home/lxe/comfyui/.venv/bin/python app_server.py --host 0.0.0.0 --port 5177
```

Open `http://<machine-ip>:5177/` from another device on the same network or Tailnet.

The local server redirects root and static asset requests to cache-busting `?v=` URLs and sends no-store cache headers, which keeps mobile Safari from holding onto stale UI builds while iterating.

## Static Hosting

The frontend is plain static HTML, CSS, and JavaScript. These files are enough for the browser UI, image loading, preview, saved presets, JPEG export, and gain-mask export:

```text
index.html
app.js
styles.css
manifest.webmanifest
vendor/open-ultrahdr/open_ultrahdr.js
vendor/open-ultrahdr/open_ultrahdr.wasm
```

Static deployment target:

```text
https://holohdr.com/
```

Ultra HDR JPEG export is handled in the browser with WebAssembly from `open-ultrahdr-wasm`, built from upstream `google/libultrahdr`.

## Export Behavior

- `Ultra HDR` locally builds an adjusted SDR JPEG plus linear HDR RGB buffer, then writes a real Ultra HDR + ISO 21496 gain-map JPEG in WebAssembly.
- `JPEG` saves the adjusted SDR fallback image directly in the browser.
- `Gain` saves a grayscale gain-mask preview PNG directly in the browser.

## Persistence

The browser stores the last loaded image and editor state in IndexedDB, so refreshing restores the previous session. Saved presets are stored in `localStorage` on the same browser/device.

## Privacy

The static hosted app does not upload images, presets, exports, or slider settings. It does not use cookies, analytics, advertising scripts, or tracking pixels. Browser storage is used only on the local device for session restore and saved presets.

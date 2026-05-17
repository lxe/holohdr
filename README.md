# HoloHDR

HoloHDR is a mobile-first browser tool for tuning ordinary photos into brighter Ultra HDR exports with gain-map controls.

The app is designed around phone use: load an image from the camera roll, preview the adjusted result, compare against the original by holding the image, tune with compact bottom controls, save custom presets, and export the version you like.

## Live App

https://holohdr.com/

## Features

- Local image loading from the browser, including iPhone Safari.
- Fixed mobile workspace with a scrollable bottom tool rail.
- HDR and SDR preview modes.
- Manual controls for exposure, contrast, shadows, highlights, SDR color, HDR color, headroom, HDR brightness, threshold, softness, power, and gain-map gamma.
- Wand menu with browser-side automatic tuning passes.
- Saved presets stored locally in the browser.
- JPEG, gain-mask, and Ultra HDR exports directly in the browser.
- No account, upload service, analytics, cookies, or tracking scripts.

## Run Locally

Any static file server works:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://127.0.0.1:8000/
```

For development, the included server adds cache-busting redirects and no-store cache headers:

```bash
python3 app_server.py
```

## Static Hosting

HoloHDR is plain static HTML, CSS, JavaScript, WebAssembly, and image assets. A production host only needs to serve the repository files over HTTPS with the correct MIME type for WebAssembly:

```text
application/wasm .wasm
```

Ultra HDR JPEG export is handled in the browser with WebAssembly from `open-ultrahdr-wasm`, built from upstream `google/libultrahdr`.

## Export Behavior

- `Ultra HDR` locally builds an adjusted SDR JPEG plus a linear HDR RGB buffer, then writes an Ultra HDR / ISO 21496 gain-map JPEG in WebAssembly.
- `JPEG` saves the adjusted SDR fallback image directly in the browser.
- `Gain` saves a grayscale gain-mask preview PNG directly in the browser.

## Persistence

The browser stores the last loaded image and editor state in IndexedDB, so refreshing restores the previous session. Saved presets are stored in `localStorage` on the same browser and device.

## Privacy

The hosted app does not upload images, presets, exports, or slider settings. It does not use cookies, analytics, advertising scripts, or tracking pixels. Browser storage is used only on the local device for session restore and saved presets.

## Credits

- Ultra HDR WebAssembly wrapper: https://www.npmjs.com/package/open-ultrahdr-wasm
- Upstream Ultra HDR encoder: https://github.com/google/libultrahdr

The vendored Ultra HDR code follows the upstream Apache-2.0 or MIT licensing noted by that project.

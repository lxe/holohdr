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

## WebAssembly Build Notes

The vendored files in `vendor/open-ultrahdr/` are an optimized browser build based on `open-ultrahdr-wasm` 0.2.0 and upstream `google/libultrahdr`.

The important build goals were:

- Keep Ultra HDR encoding fully client-side.
- Stay compatible with mobile Safari.
- Avoid requiring cross-origin isolation headers.
- Keep preview/export work off the main thread where possible.
- Expose libultrahdr options HoloHDR needs for previews, including realtime mode and multi-channel gain maps.

The build is intentionally single-threaded. Emscripten pthreads can improve throughput, but browsers require `SharedArrayBuffer` and cross-origin isolation for pthread-backed WASM. HoloHDR avoids that requirement so the app can run as a simple static site on iPhone Safari and other mobile browsers.

The optimized build uses the same shape as the upstream wrapper, with these key Emscripten choices:

```bash
emcmake cmake -S . -B build-wasm \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_CXX_FLAGS_RELEASE="-O3 -flto -msimd128"

emmake cmake --build build-wasm --config Release
```

For an equivalent manual `emcc`/`em++` setup, the relevant flags are:

```text
-O3
-flto
-msimd128
-s MODULARIZE=1
-s EXPORT_ES6=1
-s ENVIRONMENT=web,worker
-s ALLOW_MEMORY_GROWTH=1
-s FILESYSTEM=0
```

Do not enable pthreads unless the deployment also sends the required cross-origin isolation headers and you are willing to drop compatibility with browsers that do not expose `SharedArrayBuffer` in that context. The current build uses SIMD but no pthreads, which is the safer compatibility/performance tradeoff for HoloHDR.

After rebuilding, replace:

```text
vendor/open-ultrahdr/open_ultrahdr.js
vendor/open-ultrahdr/open_ultrahdr.wasm
```

Then verify:

```bash
node --check app.js
node --check ultrahdr-worker.js
python3 -m json.tool manifest.webmanifest >/dev/null
```

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

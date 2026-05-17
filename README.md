# HDR Gain Map Tuner

Mobile-friendly browser prototype for tuning the LXE Ultra HDR gain-map style settings against a local image.

## Run

```bash
/home/lxe/comfyui/.venv/bin/python app_server.py --host 0.0.0.0 --port 5177
```

Open `http://<machine-ip>:5177/` from another device on the same network or Tailnet.

The server redirects root and static asset requests to a `?v=` URL derived from the local app file mtimes, and sends no-store cache headers. That keeps mobile Safari from holding onto stale UI builds while iterating.

The browser stores the last loaded image and editor state in IndexedDB, so refreshing the page restores the previous session.

## Current export behavior

- `Export Ultra HDR` sends the image/settings to the local Python endpoint and saves a real Ultra HDR + ISO 21496 gain-map JPEG.
- `Export JPEG` saves the adjusted SDR fallback image directly in the browser.
- `Export Gain` saves a grayscale gain-mask preview PNG.

The live preview uses the same SDR adjustment, highlight mask, headroom, saturation, and gain gamma controls as the ComfyUI node. The Ultra HDR export path reuses the installed Python `hdr-conversion` stack instead of a browser/WASM JPEG metadata writer.

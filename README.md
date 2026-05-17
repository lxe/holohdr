# HDR Gain Map Tuner

Mobile-friendly browser prototype for tuning the LXE Ultra HDR gain-map style settings against a local image.

## Run

```bash
python3 -m http.server 5177 --bind 0.0.0.0
```

Open `http://<machine-ip>:5177/` from another device on the same network or Tailnet.

## Current export behavior

- `Export JPEG` saves the adjusted SDR fallback image.
- `Export Gain` saves a grayscale gain-mask preview PNG.

This first pass does not write embedded Ultra HDR / ISO 21496 JPEG metadata in the browser. The live preview uses the same SDR adjustment, highlight mask, headroom, saturation, and gain gamma controls as the ComfyUI node, but the final Ultra HDR gain-map JPEG writer still needs either a server-side Python endpoint or a browser/WASM JPEG metadata writer.

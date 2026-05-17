# Open UltraHDR WASM

This directory vendors a browser WASM build based on `open-ultrahdr-wasm` 0.2.0, built from upstream `google/libultrahdr`.

HoloHDR's vendored build is rebuilt locally with Emscripten `-O3`, LTO, and `-msimd128`, with no pthreads so it remains compatible with mobile Safari without requiring cross-origin isolation headers. The binding also exposes libultrahdr's realtime preset and multi-channel gain-map option for faster previews.

- Package: https://www.npmjs.com/package/open-ultrahdr-wasm
- Source: https://github.com/adamsilverstein/lib-open-ultrahdr
- Upstream encoder: https://github.com/google/libultrahdr
- License: Apache-2.0 OR MIT, matching upstream libultrahdr.

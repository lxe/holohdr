# Open UltraHDR WASM

This directory vendors a browser WASM build based on `open-ultrahdr-wasm` 0.2.0, built from upstream `google/libultrahdr`.

HoloHDR's vendored build is rebuilt locally with Emscripten `-O3`, LTO, and `-msimd128`, with no pthreads so it remains compatible with mobile Safari without requiring cross-origin isolation headers. The binding also exposes libultrahdr's realtime preset and multi-channel gain-map option for faster previews.

Apply `patches/0001-preserve-sdr-intent.patch` before rebuilding. The root `Makefile` does this through `make wasm` by copying the `third_party/lib-open-ultrahdr` submodule into `.build/`, patching that copy, building, and replacing the two vendored runtime artifacts in this directory.

The patch sends the browser JPEG through libultrahdr as the SDR intent (`UHDR_SDR_IMG`) and declares the SDR/HDR buffers as BT.709/sRGB-compatible data. Without this patch, the encoder treats the input JPEG as a base image while deriving the gain map from a BT.2100 HDR buffer, which can produce a neutral Ultra HDR file whose SDR rendition is already darker and more saturated than the source.

- Package: https://www.npmjs.com/package/open-ultrahdr-wasm
- Source: https://github.com/adamsilverstein/lib-open-ultrahdr
- Upstream encoder: https://github.com/google/libultrahdr
- License: Apache-2.0 OR MIT, matching upstream libultrahdr.

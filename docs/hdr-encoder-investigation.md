# HDR Encoder Investigation

This is the debugging log for the Ultra HDR color regression that appeared after HoloHDR moved from a server-side encoder path to browser-side WebAssembly encoding with `open-ultrahdr-wasm`.

The short version: the WASM wrapper was feeding libultrahdr the browser JPEG as `UHDR_BASE_IMG` while also feeding a raw HDR image as `UHDR_HDR_IMG`. That was not the intended "preserve this SDR image and attach a gain map" path. It let libultrahdr reinterpret or regenerate the SDR intent through a different color pipeline. Neutral Ultra HDR output could become darker and more saturated before any user adjustment was applied.

The fix is recorded as `vendor/open-ultrahdr/patches/0001-preserve-sdr-intent.patch` and applied by `make wasm`.

## Symptom

The app's SDR canvas preview looked normal, but generated Ultra HDR JPEGs looked visibly different even with a neutral/reset configuration:

- Purples, dark greens, and saturated regions became too dark.
- Raising headroom above 1 created an aggressive saturation and contrast jump.
- The HDR color control seemed unstable because tiny changes could push the generated HDR output into a much stronger color transform than intended.
- Server-generated Ultra HDR files from the earlier path did not show the same neutral shift.

The important expectation was:

> A neutral Ultra HDR export should preserve the SDR base image. HDR data should add display headroom only where the sliders ask for it.

## Test Fixture

The debugging fixture lives in `hdr-comparison/`.

Important files:

- `input.png`: source image used for visual checks.
- `input-sdr-q96.jpg`: browser-style SDR JPEG baseline.
- `server-neutral.jpg`: server-side neutral Ultra HDR output.
- `server-old-rgb-neutral.jpg`: old server RGB gain-map experiment.
- `wasm-neutral.jpg`: old WASM neutral output before the fix.
- `wasm-bt709-neutral.jpg`: intermediate BT.709-only experiment.
- `wasm-sdrintent-neutral.jpg`: patched WASM neutral output.
- `wasm-sdrintent-headroom3-color1.jpg`: patched WASM adjusted output.
- `index.html`: browser comparison grid.

The two `.f32` files are raw linear HDR RGB buffers used to regenerate the WASM comparison images.

## Comparison Method

The investigation used three kinds of checks.

First, view the outputs directly in a browser that can present Ultra HDR:

```text
hdr-comparison/index.html
```

Second, inspect Ultra HDR structure and metadata through the vendored WASM module:

```js
import fs from "node:fs";
import path from "node:path";
import createModule from "./vendor/open-ultrahdr/open_ultrahdr.js";

const wasm = await createModule({
  locateFile: (file) => path.resolve("vendor/open-ultrahdr", file),
});

for (const name of ["server-neutral.jpg", "wasm-neutral.jpg"]) {
  const bytes = new Uint8Array(fs.readFileSync(`hdr-comparison/${name}`));
  console.log(name, wasm.probeUltraHdr(bytes));
  console.log(wasm.getMetadata(bytes));
  fs.writeFileSync(
    `hdr-comparison/${name.replace(".jpg", "-extracted-sdr.jpg")}`,
    Buffer.from(wasm.extractSdrBase(bytes)),
  );
}
```

Third, compare normal SDR decodes using ImageMagick:

```bash
magick compare -metric MAE hdr-comparison/input-sdr-q96.jpg hdr-comparison/wasm-neutral.jpg null:
magick compare -metric MAE hdr-comparison/input-sdr-q96.jpg hdr-comparison/wasm-sdrintent-neutral.jpg null:
```

The key metric was not "does the HDR image look exciting?" It was "does neutral preserve the SDR base?"

## What The Numbers Showed

Before the fix:

```text
server-neutral.jpg mean error vs input-sdr-q96.jpg: 0.00376297
wasm-neutral.jpg mean error vs input-sdr-q96.jpg:   0.117356
```

After the fix:

```text
wasm-sdrintent-neutral.jpg mean error vs input-sdr-q96.jpg: 0
```

Metadata also exposed the problem. The old WASM neutral output reported about `5.62` stops of gain for a neutral encode. The patched neutral output reports about `0.1` stop in the active gain-map max field, which is the library's effective floor rather than a large unintended boost.

## False Leads

### RGB Gain Maps

One early suspicion was that multi-channel RGB gain maps were causing hue-dependent amplification. Switching previews to a single-channel gain map was still useful because it better matches the desired "brightness without color drift" behavior, but it did not fully solve the neutral export bug.

The server-side old RGB neutral output was also added to the comparison set. It did not reproduce the same severe shift, which made it unlikely that "RGB versus luma gain maps" was the root cause.

### HDR Raw Gamut Only

The first source-level patch changed:

```cpp
hdrRaw.cg = UHDR_CG_BT_2100;
```

to:

```cpp
hdrRaw.cg = UHDR_CG_BT_709;
```

That was directionally correct because HoloHDR was generating linear RGB from an sRGB/BT.709 canvas path, not BT.2100 RGB. It slightly improved some decoded SDR differences, but neutral WASM still reported roughly `5.62` stops and still did not preserve the SDR base. So gamut tagging alone was not enough.

## Source Spelunking

The wrapper entry point is in the upstream submodule:

```text
third_party/lib-open-ultrahdr/wasm/src/bindings.cpp
```

The original wrapper configured the compressed browser JPEG like this:

```cpp
uhdr_compressed_image_t baseImg{};
baseImg.data = sdr.data();
baseImg.data_sz = sdr.size();
baseImg.capacity = sdr.size();
baseImg.cg = UHDR_CG_UNSPECIFIED;
baseImg.ct = UHDR_CT_UNSPECIFIED;
baseImg.range = UHDR_CR_UNSPECIFIED;
throwOnError(uhdr_enc_set_compressed_image(enc.get(), &baseImg, UHDR_BASE_IMG),
             "uhdr_enc_set_compressed_image");
```

Then it passed the raw HDR image separately:

```cpp
uhdr_raw_image_t hdrRaw{};
hdrRaw.fmt = UHDR_IMG_FMT_64bppRGBAHalfFloat;
hdrRaw.cg = UHDR_CG_BT_2100;
hdrRaw.ct = UHDR_CT_LINEAR;
hdrRaw.range = UHDR_CR_FULL_RANGE;
throwOnError(uhdr_enc_set_raw_image(enc.get(), &hdrRaw, UHDR_HDR_IMG),
             "uhdr_enc_set_raw_image");
```

The important libultrahdr dispatch is in:

```text
third_party/lib-open-ultrahdr/wasm/third_party/libultrahdr/lib/src/ultrahdr_api.cpp
```

That file has separate encode paths depending on whether the encoder receives:

- a base image plus an already-compressed gain map,
- raw HDR only,
- raw HDR plus compressed SDR intent,
- raw HDR plus raw SDR intent,
- raw HDR plus both raw and compressed SDR intent.

For HoloHDR, the desired path is raw HDR plus compressed SDR intent. The browser already has an adjusted SDR JPEG that should remain the fallback/base image. The encoder should generate a gain map against that SDR intent and append it.

The old wrapper did not use that path. It put the JPEG in the base-image slot, not the SDR-intent slot.

## The Telltale Tone Mapping Path

In libultrahdr's `jpegr.cpp`, the raw-HDR-only path tone maps from HDR to make an SDR intent. During source reading, this block stood out:

```cpp
sdr_intent->cg = UHDR_CG_DISPLAY_P3;
sdr_intent->ct = UHDR_CT_SRGB;
sdr_intent->range = UHDR_CR_FULL_RANGE;
```

That was a strong clue. The unwanted output looked like a new SDR rendition had been made through a different gamut/tone mapping path rather than simply preserving the supplied browser JPEG.

The API-3 path, by contrast, is explicitly:

```cpp
uhdr_error_info_t JpegR::encodeJPEGR(
    uhdr_raw_image_t* hdr_intent,
    uhdr_compressed_image_t* sdr_intent_compressed,
    uhdr_compressed_image_t* dest)
```

It decompresses the supplied SDR JPEG only to generate the gain map, then appends the compressed gain map to the original compressed SDR intent.

That matched HoloHDR's needs.

## The First Correct Patch

The first real fix was changing `UHDR_BASE_IMG` to `UHDR_SDR_IMG`.

That immediately hit this error:

```text
uhdr_encode: Unrecognized 420 color gamut -1
```

That error was useful. It confirmed we had reached the compressed SDR-intent code path, but the browser-created JPEG had no ICC profile and the wrapper had left the compressed image color fields unspecified.

So the final wrapper patch does two things:

1. Sends the compressed browser JPEG as `UHDR_SDR_IMG`.
2. Declares the SDR and raw HDR buffers as BT.709/sRGB-compatible data.

The patched compressed SDR setup is:

```cpp
uhdr_compressed_image_t sdrImg{};
sdrImg.data = sdr.data();
sdrImg.data_sz = sdr.size();
sdrImg.capacity = sdr.size();
sdrImg.cg = UHDR_CG_BT_709;
sdrImg.ct = UHDR_CT_SRGB;
sdrImg.range = UHDR_CR_FULL_RANGE;
throwOnError(uhdr_enc_set_compressed_image(enc.get(), &sdrImg, UHDR_SDR_IMG),
             "uhdr_enc_set_compressed_image");
```

The patched raw HDR setup is:

```cpp
uhdr_raw_image_t hdrRaw{};
hdrRaw.fmt = UHDR_IMG_FMT_64bppRGBAHalfFloat;
hdrRaw.cg = UHDR_CG_BT_709;
hdrRaw.ct = UHDR_CT_LINEAR;
hdrRaw.range = UHDR_CR_FULL_RANGE;
```

## Reproducible Build Path

The upstream library is tracked as a submodule:

```text
third_party/lib-open-ultrahdr
```

HoloHDR does not modify the submodule in place. `make wasm` copies it into `.build/`, applies the patch, builds, and copies the runtime artifacts back into `vendor/open-ultrahdr/`.

```bash
make wasm
```

The patch also adds the actual optimization flags used by the vendored build:

```text
-O3
-flto
-msimd128
```

The build intentionally does not enable Emscripten pthreads. Pthreads would require `SharedArrayBuffer` and cross-origin isolation. HoloHDR keeps the encoder single-threaded for broad mobile Safari compatibility.

## Why The Server Path Looked Better

The older server-side path effectively preserved the SDR base and attached gain information in the intended color space. It did not force the supplied SDR image through libultrahdr's raw-HDR tone-map path.

The WASM regression was not caused by "WASM being worse" or Safari doing something strange. It was caused by using the wrong libultrahdr encoder intent for the data HoloHDR had:

- HoloHDR had an SDR JPEG plus an HDR raw buffer.
- The wrapper marked the SDR JPEG as a base image, not an SDR intent.
- libultrahdr therefore did not behave like the old server path.

Once the WASM wrapper used the SDR-intent API, the browser path matched the intended model.

## Current Expected Behavior

Neutral/reset export:

- Preserves the SDR base image.
- Produces no large visible saturation jump.
- Keeps the normal SDR fallback suitable for non-HDR viewers and platforms.

Adjusted HDR export:

- Uses the browser-generated SDR JPEG as the fallback/base rendition.
- Generates the gain map from HoloHDR's linear HDR buffer.
- Lets headroom and HDR brightness affect display luminance without forcing unexpected color shifts into the base image.

## Useful Commands

Rebuild the vendored encoder:

```bash
make wasm
```

Verify static syntax and manifest JSON:

```bash
make verify
```

Build the static publish directory:

```bash
make site
```

Publish to a static host:

```bash
make publish DEPLOY_TARGET=user@example.com:/absolute/site/path/
```

Check the live WASM MIME type:

```bash
curl -I https://holohdr.com/vendor/open-ultrahdr/open_ultrahdr.wasm
```

Compare neutral outputs:

```bash
magick compare -metric MAE hdr-comparison/input-sdr-q96.jpg hdr-comparison/wasm-neutral.jpg null:
magick compare -metric MAE hdr-comparison/input-sdr-q96.jpg hdr-comparison/wasm-sdrintent-neutral.jpg null:
```

## Takeaway

Ultra HDR encoding is very sensitive to the distinction between a base image, an SDR intent, a raw HDR intent, and an already-generated gain map. The browser app had the right ingredients, but the wrapper was handing one ingredient to libultrahdr under the wrong role.

The practical rule for HoloHDR is:

> If the browser has already produced the SDR JPEG that should be preserved, pass it to libultrahdr as `UHDR_SDR_IMG`, not `UHDR_BASE_IMG`.

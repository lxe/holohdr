const STATIC_ASSET_VERSION = "20260517v";

let wasmPromise = null;

self.addEventListener("message", async (event) => {
  const { id, sdrBuffer, hdrBuffer, options } = event.data || {};
  if (!id) return;

  try {
    const wasm = await getUltraHdrWasm();
    const encoded = wasm.encodeUltraHdr(new Uint8Array(sdrBuffer), new Float32Array(hdrBuffer), options);
    const output = encoded.slice();
    self.postMessage({ id, outputBuffer: output.buffer }, [output.buffer]);
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : "Ultra HDR worker encode failed.",
    });
  }
});

function getUltraHdrWasm() {
  if (!wasmPromise) {
    wasmPromise = import(`./vendor/open-ultrahdr/open_ultrahdr.js?v=${STATIC_ASSET_VERSION}`).then(({ default: createModule }) =>
      createModule({
        locateFile: (path) =>
          path.endsWith(".wasm") ? `./vendor/open-ultrahdr/open_ultrahdr.wasm?v=${STATIC_ASSET_VERSION}` : path,
      }),
    );
  }
  return wasmPromise;
}

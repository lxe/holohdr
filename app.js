const PREVIEW_MAX_SIDE = 1800;
const EXPORT_MIME = "image/jpeg";
const JPEG_QUALITY = 0.96;

const sliders = [
  ["sdrExposure", "SDR exposure", -1, 1.5, 0.01],
  ["sdrContrast", "SDR contrast", 0.5, 1.5, 0.01],
  ["sdrSaturation", "SDR saturation", 0, 2.5, 0.01],
  ["hdrHeadroom", "HDR headroom", 1, 12, 0.1],
  ["highlightThreshold", "Highlight threshold", 0, 1, 0.01],
  ["highlightSoftness", "Highlight softness", 0.01, 1, 0.01],
  ["highlightPower", "Highlight power", 0.1, 5, 0.01],
  ["hdrSaturation", "HDR saturation", 0, 2.5, 0.01],
  ["gainmapGamma", "Gain-map gamma", 0.1, 4, 0.01],
];

const presets = {
  custom: null,
  vibrant: {
    sdrExposure: 0.26,
    sdrContrast: 0.93,
    sdrSaturation: 1.34,
    hdrHeadroom: 5.5,
    highlightThreshold: 0.14,
    highlightSoftness: 0.9,
    highlightPower: 0.54,
    hdrSaturation: 1.72,
    gainmapGamma: 0.68,
  },
  holosomnia: {
    sdrExposure: 0.1,
    sdrContrast: 1.02,
    sdrSaturation: 1.12,
    hdrHeadroom: 5.5,
    highlightThreshold: 0.23,
    highlightSoftness: 0.74,
    highlightPower: 0.75,
    hdrSaturation: 1.46,
    gainmapGamma: 0.75,
  },
  instagram_safe: {
    sdrExposure: 0,
    sdrContrast: 1,
    sdrSaturation: 1,
    hdrHeadroom: 3,
    highlightThreshold: 0.55,
    highlightSoftness: 0.35,
    highlightPower: 1.25,
    hdrSaturation: 1.08,
    gainmapGamma: 1,
  },
  instagram_bright: {
    sdrExposure: -0.05,
    sdrContrast: 1,
    sdrSaturation: 1.03,
    hdrHeadroom: 5,
    highlightThreshold: 0.35,
    highlightSoftness: 0.5,
    highlightPower: 0.9,
    hdrSaturation: 1.18,
    gainmapGamma: 0.9,
  },
  instagram_blast: {
    sdrExposure: -0.1,
    sdrContrast: 1.05,
    sdrSaturation: 1.08,
    hdrHeadroom: 7,
    highlightThreshold: 0.22,
    highlightSoftness: 0.68,
    highlightPower: 0.6,
    hdrSaturation: 1.32,
    gainmapGamma: 0.8,
  },
};

const state = {
  sourceImage: null,
  sourceDataUrl: null,
  sourceName: "image",
  previewSource: null,
  previewMode: "hdr",
  settings: { ...presets.vibrant },
  renderToken: 0,
};

const fileInput = document.getElementById("fileInput");
const previewCanvas = document.getElementById("previewCanvas");
const emptyState = document.getElementById("emptyState");
const imageMeta = document.getElementById("imageMeta");
const controlsPanel = document.getElementById("controlsPanel");
const sheetToggle = document.getElementById("sheetToggle");
const presetSelect = document.getElementById("presetSelect");
const sliderStack = document.getElementById("sliderStack");
const statusLine = document.getElementById("statusLine");
const exportSize = document.getElementById("exportSize");
const exportUltra = document.getElementById("exportUltra");
const exportJpeg = document.getElementById("exportJpeg");
const exportGain = document.getElementById("exportGain");
const previewCtx = previewCanvas.getContext("2d", { willReadFrequently: true });

buildControls();
applySettingsToControls();

fileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  if (!file) return;
  await loadFile(file);
});

presetSelect.addEventListener("change", () => {
  const preset = presets[presetSelect.value];
  if (!preset) return;
  state.settings = { ...preset };
  applySettingsToControls();
  schedulePreview();
});

document.querySelectorAll(".segment").forEach((button) => {
  button.addEventListener("click", () => {
    state.previewMode = button.dataset.mode;
    document.querySelectorAll(".segment").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    schedulePreview();
  });
});

exportJpeg.addEventListener("click", () => exportProcessed("jpeg"));
exportGain.addEventListener("click", () => exportProcessed("gain"));
exportUltra.addEventListener("click", () => exportUltraHdr());
sheetToggle.addEventListener("click", () => setControlsOpen(!controlsPanel.classList.contains("open")));
previewCanvas.addEventListener("click", () => {
  if (window.matchMedia("(max-width: 860px)").matches) setControlsOpen(false);
});

function buildControls() {
  sliderStack.innerHTML = "";
  for (const [key, label, min, max, step] of sliders) {
    const card = document.createElement("div");
    card.className = "slider-card";
    card.innerHTML = `
      <div class="slider-head">
        <label for="${key}">${label}</label>
        <span class="slider-value" id="${key}Value"></span>
      </div>
      <input id="${key}" type="range" min="${min}" max="${max}" step="${step}" />
    `;
    sliderStack.appendChild(card);

    const input = document.getElementById(key);
    input.addEventListener("input", () => {
      state.settings[key] = Number(input.value);
      presetSelect.value = "custom";
      updateValueLabel(key);
      schedulePreview();
    });
  }
}

function applySettingsToControls() {
  for (const [key] of sliders) {
    const input = document.getElementById(key);
    input.value = state.settings[key];
    updateValueLabel(key);
  }
}

function updateValueLabel(key) {
  document.getElementById(`${key}Value`).textContent = Number(state.settings[key]).toFixed(2);
}

async function loadFile(file) {
  setStatus("Loading image...");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();

    state.sourceImage = img;
    state.sourceDataUrl = await fileToDataUrl(file);
    state.sourceName = file.name.replace(/\.[^.]+$/, "") || "image";
    state.previewSource = makeSourceCanvas(img, PREVIEW_MAX_SIDE);

    imageMeta.textContent = `${img.naturalWidth} x ${img.naturalHeight}`;
    emptyState.style.display = "none";
    previewCanvas.style.display = "block";
    exportUltra.disabled = false;
    exportJpeg.disabled = false;
    exportGain.disabled = false;
    setControlsOpen(false);
    schedulePreview();
    setStatus("Ready");
  } catch (error) {
    console.error(error);
    setStatus("Could not load that image.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function setControlsOpen(open) {
  controlsPanel.classList.toggle("open", open);
  sheetToggle.setAttribute("aria-expanded", String(open));
}

function schedulePreview() {
  if (!state.previewSource) return;
  const token = ++state.renderToken;
  requestAnimationFrame(() => {
    if (token !== state.renderToken) return;
    renderPreview();
  });
}

function renderPreview() {
  const source = state.previewSource;
  previewCanvas.width = source.width;
  previewCanvas.height = source.height;
  previewCtx.drawImage(source, 0, 0);
  const imageData = previewCtx.getImageData(0, 0, source.width, source.height);
  processPixels(imageData.data, state.settings, state.previewMode);
  previewCtx.putImageData(imageData, 0, 0);
}

async function exportProcessed(kind) {
  if (!state.sourceImage) return;
  const token = ++state.renderToken;
  setStatus("Rendering export...");
  await nextFrame();
  if (token !== state.renderToken) return;

  const maxSide = exportSize.value === "full" ? Infinity : exportSize.value === "preview" ? PREVIEW_MAX_SIDE : Number(exportSize.value);
  const source = makeSourceCanvas(state.sourceImage, maxSide);
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  processPixels(imageData.data, state.settings, kind === "gain" ? "gain" : "sdr");
  ctx.putImageData(imageData, 0, 0);

  const blob = await canvasToBlob(canvas, kind === "gain" ? "image/png" : EXPORT_MIME, JPEG_QUALITY);
  downloadBlob(blob, `${state.sourceName}-${kind === "gain" ? "gainmap" : "adjusted"}.${kind === "gain" ? "png" : "jpg"}`);
  setStatus(`Exported ${canvas.width} x ${canvas.height}`);
}

async function exportUltraHdr() {
  if (!state.sourceImage || !state.sourceDataUrl) return;
  setStatus("Rendering Ultra HDR...");
  try {
    const imageDataUrl = await getExportImageDataUrl();
    const response = await fetch("./api/export-ultrahdr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: state.sourceName,
        image: imageDataUrl,
        settings: state.settings,
        exportSize: exportSize.value,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Export failed with HTTP ${response.status}`);
    }

    const blob = await response.blob();
    downloadBlob(blob, `${state.sourceName}-ultrahdr.jpg`);
    setStatus("Exported Ultra HDR JPEG");
  } catch (error) {
    console.error(error);
    setStatus("Ultra HDR export failed. Run with app_server.py.");
  }
}

function makeSourceCanvas(img, maxSide) {
  const srcWidth = img.naturalWidth || img.width;
  const srcHeight = img.naturalHeight || img.height;
  const scale = Math.min(1, maxSide / Math.max(srcWidth, srcHeight));
  const width = Math.max(1, Math.round(srcWidth * scale));
  const height = Math.max(1, Math.round(srcHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

async function getExportImageDataUrl() {
  if (exportSize.value === "full") return state.sourceDataUrl;
  const maxSide = exportSize.value === "preview" ? PREVIEW_MAX_SIDE : Number(exportSize.value);
  const source = makeSourceCanvas(state.sourceImage, maxSide);
  return source.toDataURL("image/png");
}

function processPixels(data, settings, mode) {
  const exposure = 2 ** settings.sdrExposure;
  const contrast = settings.sdrContrast;
  const sdrSat = settings.sdrSaturation;
  const threshold = settings.highlightThreshold;
  const softness = settings.highlightSoftness;
  const power = settings.highlightPower;
  const headroom = settings.hdrHeadroom;
  const hdrSat = settings.hdrSaturation;
  const gamma = settings.gainmapGamma;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] / 255;
    let g = data[i + 1] / 255;
    let b = data[i + 2] / 255;

    r = clamp01((r * exposure - 0.5) * contrast + 0.5);
    g = clamp01((g * exposure - 0.5) * contrast + 0.5);
    b = clamp01((b * exposure - 0.5) * contrast + 0.5);

    const sdrLuma = luma(r, g, b);
    r = clamp01(sdrLuma + (r - sdrLuma) * sdrSat);
    g = clamp01(sdrLuma + (g - sdrLuma) * sdrSat);
    b = clamp01(sdrLuma + (b - sdrLuma) * sdrSat);

    const lr = srgbToLinear(r);
    const lg = srgbToLinear(g);
    const lb = srgbToLinear(b);
    const ll = luma(lr, lg, lb);
    let mask = smoothstep(threshold, threshold + softness, ll);
    mask = Math.pow(clamp01(mask), power);

    const boost = 1 + (headroom - 1) * mask;
    let hr = lr * boost;
    let hg = lg * boost;
    let hb = lb * boost;
    const hl = luma(hr, hg, hb);
    const sat = 1 + (hdrSat - 1) * mask;
    hr = Math.max(0, hl + (hr - hl) * sat);
    hg = Math.max(0, hl + (hg - hl) * sat);
    hb = Math.max(0, hl + (hb - hl) * sat);

    if (mode === "gain") {
      const encoded = Math.pow(mask, 1 / gamma);
      data[i] = Math.round(encoded * 255);
      data[i + 1] = Math.round(encoded * 255);
      data[i + 2] = Math.round(encoded * 255);
      continue;
    }

    if (mode === "hdr") {
      const mappedR = toneMapPreview(hr);
      const mappedG = toneMapPreview(hg);
      const mappedB = toneMapPreview(hb);
      data[i] = Math.round(linearToSrgb(mappedR) * 255);
      data[i + 1] = Math.round(linearToSrgb(mappedG) * 255);
      data[i + 2] = Math.round(linearToSrgb(mappedB) * 255);
      continue;
    }

    data[i] = Math.round(r * 255);
    data[i + 1] = Math.round(g * 255);
    data[i + 2] = Math.round(b * 255);
  }
}

function toneMapPreview(value) {
  const shoulder = Math.max(0, value - 1);
  return clamp01(value / (1 + shoulder * 0.42));
}

function srgbToLinear(value) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value) {
  value = clamp01(value);
  return value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
}

function luma(r, g, b) {
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function smoothstep(edge0, edge1, value) {
  if (edge1 <= edge0) edge1 = edge0 + 1e-6;
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas export failed"));
      },
      type,
      quality,
    );
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function setStatus(message) {
  statusLine.textContent = message;
}

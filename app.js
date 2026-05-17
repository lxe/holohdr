const PREVIEW_MAX_SIDE = 1800;
const EXPORT_MIME = "image/jpeg";
const JPEG_QUALITY = 0.96;
const ORIGINAL_PEEK_DELAY_MS = 10;
const SESSION_DB_NAME = "hdr-gainmap-tuner";
const SESSION_DB_VERSION = 1;
const SESSION_STORE = "session";
const SESSION_KEY = "last";

const sliders = [
  {
    key: "sdrExposure",
    label: "Exposure",
    min: -1,
    max: 1.5,
    step: 0.01,
    group: "tone",
    description: "Moves the whole SDR base brighter or darker before the HDR gain is built.",
  },
  {
    key: "sdrContrast",
    label: "Contrast",
    min: 0.5,
    max: 1.5,
    step: 0.01,
    group: "tone",
    description: "Expands or compresses the SDR base around middle gray.",
  },
  {
    key: "sdrShadows",
    label: "Shadows",
    min: -1,
    max: 1,
    step: 0.01,
    group: "shadows",
    description: "Lifts or deepens darker colors without moving the bright parts as much.",
  },
  {
    key: "sdrHighlights",
    label: "Highlights",
    min: -1,
    max: 1,
    step: 0.01,
    group: "highlights",
    description: "Recovers or boosts the brighter SDR areas before HDR processing.",
  },
  {
    key: "sdrSaturation",
    label: "SDR color",
    min: 0,
    max: 2.5,
    step: 0.01,
    group: "color",
    description: "Changes the color intensity of the SDR fallback that every app can display.",
  },
  {
    key: "hdrSaturation",
    label: "HDR color",
    min: 0,
    max: 2.5,
    step: 0.01,
    group: "color",
    description: "Adds extra saturation only where the HDR gain response is active.",
  },
  {
    key: "hdrHeadroom",
    label: "Headroom",
    min: 1,
    max: 12,
    step: 0.1,
    group: "headroom",
    description: "Sets the maximum HDR brightness multiplier available to boosted areas.",
  },
  {
    key: "highlightThreshold",
    label: "Threshold",
    min: 0,
    max: 1,
    step: 0.01,
    group: "threshold",
    description: "Chooses how bright a pixel must be before HDR gain starts.",
  },
  {
    key: "highlightSoftness",
    label: "Softness",
    min: 0.01,
    max: 1,
    step: 0.01,
    group: "softness",
    description: "Controls how gradually the HDR boost ramps from midtones into highlights.",
  },
  {
    key: "highlightPower",
    label: "Power",
    min: 0.1,
    max: 5,
    step: 0.01,
    group: "power",
    description: "Shapes the HDR mask; lower values spread the effect, higher values isolate it.",
  },
  {
    key: "gainmapGamma",
    label: "Gamma",
    min: 0.1,
    max: 4,
    step: 0.01,
    group: "gamma",
    description: "Bends the gain response so HDR boost appears earlier or later in the ramp.",
  },
];

const presets = {
  custom: null,
  vibrant: {
    sdrExposure: 0.26,
    sdrContrast: 0.93,
    sdrShadows: 0,
    sdrHighlights: 0,
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
    sdrShadows: 0,
    sdrHighlights: 0,
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
    sdrShadows: 0,
    sdrHighlights: 0,
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
    sdrShadows: 0,
    sdrHighlights: 0,
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
    sdrShadows: 0,
    sdrHighlights: 0,
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
  peekingOriginal: false,
  viewScale: 1,
  viewX: 0,
  viewY: 0,
  settings: { ...presets.vibrant },
  renderToken: 0,
};

const gesture = {
  pointers: new Map(),
  longPressTimer: 0,
  longPressStart: null,
  panStart: null,
  pinchStart: null,
  suppressClick: false,
};

const fileInput = document.getElementById("fileInput");
const previewCanvas = document.getElementById("previewCanvas");
const emptyState = document.getElementById("emptyState");
const imageMeta = document.getElementById("imageMeta");
const controlsPanel = document.getElementById("controlsPanel");
const toolPanel = document.getElementById("toolPanel");
const toolRailShell = document.getElementById("toolRailShell");
const toolRail = document.getElementById("toolRail");
const presetSelect = document.getElementById("presetSelect");
const sliderStacks = {
  tone: document.getElementById("toneSliderStack"),
  shadows: document.getElementById("shadowsSliderStack"),
  highlights: document.getElementById("highlightsSliderStack"),
  color: document.getElementById("colorSliderStack"),
  headroom: document.getElementById("headroomSliderStack"),
  threshold: document.getElementById("thresholdSliderStack"),
  softness: document.getElementById("softnessSliderStack"),
  power: document.getElementById("powerSliderStack"),
  gamma: document.getElementById("gammaSliderStack"),
};
const statusLine = document.getElementById("statusLine");
const exportSize = document.getElementById("exportSize");
const exportUltra = document.getElementById("exportUltra");
const exportJpeg = document.getElementById("exportJpeg");
const exportGain = document.getElementById("exportGain");
const menuOpen = document.getElementById("menuOpen");
const menuClear = document.getElementById("menuClear");
const previewCtx = previewCanvas.getContext("2d", { willReadFrequently: true });

buildControls();
applySettingsToControls();
updateRailFades();
restoreSession();

fileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  if (!file) return;
  await loadFile(file);
  fileInput.value = "";
});

presetSelect.addEventListener("change", () => {
  const preset = presets[presetSelect.value];
  if (!preset) return;
  state.settings = { ...preset };
  applySettingsToControls();
  schedulePreview();
  saveSessionSoon();
});

document.querySelectorAll(".segment").forEach((button) => {
  button.addEventListener("click", () => {
    setPreviewMode(button.dataset.mode);
    schedulePreview();
    saveSessionSoon();
  });
});

exportJpeg.addEventListener("click", () => exportProcessed("jpeg"));
exportGain.addEventListener("click", () => exportProcessed("gain"));
exportUltra.addEventListener("click", () => exportUltraHdr());
exportSize.addEventListener("change", saveSessionSoon);
emptyState.addEventListener("click", openImagePicker);
menuOpen.addEventListener("click", openImagePicker);
menuClear.addEventListener("click", clearImage);
toolRail.addEventListener("scroll", updateRailFades, { passive: true });
window.addEventListener("resize", updateRailFades);
document.querySelectorAll(".tool-button").forEach((button) => {
  button.addEventListener("click", () => {
    const wasOpen = controlsPanel.classList.contains("open");
    const wasActive = button.classList.contains("active");
    setActiveTool(button.dataset.tool);
    button.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setControlsOpen(!(wasOpen && wasActive));
    window.setTimeout(updateRailFades, 180);
  });
});
previewCanvas.addEventListener("click", () => {
  if (gesture.suppressClick) {
    gesture.suppressClick = false;
    return;
  }
  if (window.matchMedia("(max-width: 860px)").matches) setControlsOpen(false);
});
previewCanvas.addEventListener("pointerdown", beginPreviewGesture);
previewCanvas.addEventListener("pointermove", updatePreviewGesture);
previewCanvas.addEventListener("pointerup", endPreviewGesture);
previewCanvas.addEventListener("pointercancel", endPreviewGesture);
previewCanvas.addEventListener("pointerleave", endPreviewGesture);
previewCanvas.addEventListener("contextmenu", (event) => event.preventDefault());

function buildControls() {
  Object.values(sliderStacks).forEach((stack) => {
    stack.innerHTML = "";
  });
  for (const { key, label, min, max, step, group, description } of sliders) {
    const card = document.createElement("div");
    card.className = "slider-card";
    card.innerHTML = `
      <div class="slider-head">
        <label for="${key}">${label}</label>
        <span class="slider-value" id="${key}Value"></span>
      </div>
      <input id="${key}" type="range" min="${min}" max="${max}" step="${step}" />
      <p class="slider-description">${description}</p>
    `;
    sliderStacks[group].appendChild(card);

    const input = document.getElementById(key);
    input.addEventListener("input", () => {
      state.settings[key] = Number(input.value);
      presetSelect.value = "custom";
      updateValueLabel(key);
      schedulePreview();
      saveSessionSoon();
    });
  }
}

function applySettingsToControls() {
  for (const { key } of sliders) {
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
  try {
    const dataUrl = await fileToDataUrl(file);
    await loadImageDataUrl(dataUrl, file.name.replace(/\.[^.]+$/, "") || "image");
    await saveSession();
    setStatus("Ready");
  } catch (error) {
    console.error(error);
    setStatus("Could not load that image.");
  }
}

async function loadImageDataUrl(dataUrl, sourceName) {
  const img = await decodeImage(dataUrl);
  state.sourceImage = img;
  state.sourceDataUrl = dataUrl;
  state.sourceName = sourceName || "image";
  state.previewSource = makeSourceCanvas(img, PREVIEW_MAX_SIDE);
  state.peekingOriginal = false;
  resetImageTransform();

  imageMeta.textContent = `${img.naturalWidth} x ${img.naturalHeight}`;
  emptyState.style.display = "none";
  previewCanvas.style.display = "block";
  setImageActionsEnabled(true);
  setControlsOpen(false);
  schedulePreview();
}

function decodeImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image decode failed"));
    img.decoding = "async";
    img.src = src;
  });
}

function setControlsOpen(open) {
  controlsPanel.classList.toggle("open", open);
  const mobile = window.matchMedia("(max-width: 860px)").matches;
  toolPanel.setAttribute("aria-hidden", String(!open && mobile));
}

function updateRailFades() {
  const maxScroll = toolRail.scrollWidth - toolRail.clientWidth;
  toolRailShell.classList.toggle("can-scroll-left", toolRail.scrollLeft > 2);
  toolRailShell.classList.toggle("can-scroll-right", toolRail.scrollLeft < maxScroll - 2);
}

function setActiveTool(tool) {
  document.querySelectorAll(".tool-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tool === tool);
  });
  document.querySelectorAll(".tool-section").forEach((section) => {
    section.classList.toggle("active", section.dataset.section === tool);
  });
}

function openImagePicker() {
  fileInput.click();
}

async function clearImage() {
  window.clearTimeout(saveTimer);
  state.sourceImage = null;
  state.sourceDataUrl = null;
  state.sourceName = "image";
  state.previewSource = null;
  state.peekingOriginal = false;
  resetImageTransform();
  imageMeta.textContent = "No image loaded";
  previewCanvas.style.display = "none";
  emptyState.style.display = "grid";
  setImageActionsEnabled(false);
  setControlsOpen(false);
  setStatus("Ready");
  try {
    await idbDelete(SESSION_KEY);
  } catch (error) {
    console.warn("Could not clear saved session", error);
  }
}

function setImageActionsEnabled(enabled) {
  exportUltra.disabled = !enabled;
  exportJpeg.disabled = !enabled;
  exportGain.disabled = !enabled;
  menuClear.disabled = !enabled;
}

function setPreviewMode(mode) {
  state.previewMode = mode;
  document.querySelectorAll(".segment").forEach((item) => {
    item.classList.toggle("active", item.dataset.mode === mode);
  });
}

function beginPreviewGesture(event) {
  if (!state.previewSource || event.button > 0) return;
  event.preventDefault();
  previewCanvas.setPointerCapture?.(event.pointerId);

  gesture.pointers.set(event.pointerId, pointFromEvent(event));
  clearLongPressTimer();

  if (gesture.pointers.size === 1) {
    const point = pointFromEvent(event);
    gesture.longPressStart = point;
    gesture.panStart = {
      pointer: point,
      x: state.viewX,
      y: state.viewY,
    };
    gesture.longPressTimer = window.setTimeout(() => {
      if (gesture.pointers.size !== 1 || !state.previewSource) return;
      state.peekingOriginal = true;
      gesture.suppressClick = true;
      renderPreview();
    }, ORIGINAL_PEEK_DELAY_MS);
    return;
  }

  if (gesture.pointers.size === 2) {
    clearLongPressTimer();
    stopOriginalPeek();
    gesture.pinchStart = makePinchStart();
  }
}

function updatePreviewGesture(event) {
  if (!gesture.pointers.has(event.pointerId)) return;
  event.preventDefault();
  const point = pointFromEvent(event);
  gesture.pointers.set(event.pointerId, point);

  if (gesture.pointers.size >= 2) {
    clearLongPressTimer();
    stopOriginalPeek();
    updatePinch();
    gesture.suppressClick = true;
    return;
  }

  const start = gesture.longPressStart;
  if (!start) return;
  const dx = point.x - start.x;
  const dy = point.y - start.y;
  const moved = Math.hypot(dx, dy);
  if (moved > 8) {
    clearLongPressTimer();
    stopOriginalPeek();
  }

  if (state.viewScale > 1 && gesture.panStart && moved > 2) {
    state.viewX = gesture.panStart.x + (point.x - gesture.panStart.pointer.x);
    state.viewY = gesture.panStart.y + (point.y - gesture.panStart.pointer.y);
    applyImageTransform();
    gesture.suppressClick = true;
  }
}

function endPreviewGesture(event) {
  if (!gesture.pointers.has(event.pointerId)) return;
  event.preventDefault();
  previewCanvas.releasePointerCapture?.(event.pointerId);
  gesture.pointers.delete(event.pointerId);
  clearLongPressTimer();
  stopOriginalPeek();

  if (gesture.pointers.size === 1) {
    const [point] = gesture.pointers.values();
    gesture.longPressStart = point;
    gesture.panStart = {
      pointer: point,
      x: state.viewX,
      y: state.viewY,
    };
    gesture.pinchStart = null;
    return;
  }

  gesture.longPressStart = null;
  gesture.panStart = null;
  gesture.pinchStart = null;
  if (state.viewScale <= 1.01) resetImageTransform();
}

function updatePinch() {
  if (!gesture.pinchStart || gesture.pointers.size < 2) return;
  const points = [...gesture.pointers.values()];
  const distance = pointDistance(points[0], points[1]);
  if (distance <= 0) return;
  const center = pointCenter(points[0], points[1]);
  state.viewScale = clamp(distance / gesture.pinchStart.distance * gesture.pinchStart.scale, 1, 5);
  state.viewX = gesture.pinchStart.x + (center.x - gesture.pinchStart.center.x);
  state.viewY = gesture.pinchStart.y + (center.y - gesture.pinchStart.center.y);
  applyImageTransform();
}

function makePinchStart() {
  const points = [...gesture.pointers.values()];
  return {
    distance: pointDistance(points[0], points[1]),
    center: pointCenter(points[0], points[1]),
    scale: state.viewScale,
    x: state.viewX,
    y: state.viewY,
  };
}

function stopOriginalPeek() {
  if (!state.peekingOriginal) return;
  state.peekingOriginal = false;
  schedulePreview();
}

function clearLongPressTimer() {
  window.clearTimeout(gesture.longPressTimer);
  gesture.longPressTimer = 0;
}

function resetImageTransform() {
  state.viewScale = 1;
  state.viewX = 0;
  state.viewY = 0;
  applyImageTransform();
}

function applyImageTransform() {
  previewCanvas.style.transform = `translate3d(${state.viewX}px, ${state.viewY}px, 0) scale(${state.viewScale})`;
}

function pointFromEvent(event) {
  return { x: event.clientX, y: event.clientY };
}

function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointCenter(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
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
  if (state.peekingOriginal) {
    applyImageTransform();
    return;
  }

  const imageData = previewCtx.getImageData(0, 0, source.width, source.height);
  processPixels(imageData.data, state.settings, state.previewMode);
  previewCtx.putImageData(imageData, 0, 0);
  applyImageTransform();
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
  const shadows = settings.sdrShadows ?? 0;
  const highlights = settings.sdrHighlights ?? 0;
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

    const tonalLuma = luma(r, g, b);
    const shadowMask = 1 - smoothstep(0.0, 0.55, tonalLuma);
    const highlightMask = smoothstep(0.45, 1.0, tonalLuma);
    r = applyTonalRange(r, shadows, shadowMask);
    g = applyTonalRange(g, shadows, shadowMask);
    b = applyTonalRange(b, shadows, shadowMask);
    r = applyTonalRange(r, highlights, highlightMask);
    g = applyTonalRange(g, highlights, highlightMask);
    b = applyTonalRange(b, highlights, highlightMask);

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
    const gainResponse = Math.pow(mask, 1 / gamma);

    const boost = 1 + (headroom - 1) * gainResponse;
    let hr = lr * boost;
    let hg = lg * boost;
    let hb = lb * boost;
    const hl = luma(hr, hg, hb);
    const sat = 1 + (hdrSat - 1) * gainResponse;
    hr = Math.max(0, hl + (hr - hl) * sat);
    hg = Math.max(0, hl + (hg - hl) * sat);
    hb = Math.max(0, hl + (hb - hl) * sat);

    if (mode === "gain") {
      data[i] = Math.round(gainResponse * 255);
      data[i + 1] = Math.round(gainResponse * 255);
      data[i + 2] = Math.round(gainResponse * 255);
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

function applyTonalRange(value, amount, mask) {
  const strength = amount * mask * 0.75;
  return clamp01(strength >= 0 ? value + (1 - value) * strength : value + value * strength);
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

let saveTimer = 0;

function saveSessionSoon() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveSession().catch((error) => {
      console.warn("Could not save session", error);
    });
  }, 180);
}

async function saveSession() {
  if (!state.sourceDataUrl) return;
  await idbSet(SESSION_KEY, {
    sourceDataUrl: state.sourceDataUrl,
    sourceName: state.sourceName,
    settings: state.settings,
    previewMode: state.previewMode,
    preset: presetSelect.value,
    exportSize: exportSize.value,
    savedAt: Date.now(),
  });
}

async function restoreSession() {
  try {
    const session = await idbGet(SESSION_KEY);
    if (!session?.sourceDataUrl) return;

    setStatus("Restoring image...");
    state.settings = { ...presets.vibrant, ...session.settings };
    presetSelect.value = session.preset || "custom";
    exportSize.value = session.exportSize || "full";
    setPreviewMode(session.previewMode || "hdr");
    applySettingsToControls();
    await loadImageDataUrl(session.sourceDataUrl, session.sourceName);
    setStatus("Restored");
  } catch (error) {
    console.warn("Could not restore session", error);
    setStatus("Ready");
  }
}

function openSessionDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SESSION_DB_NAME, SESSION_DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(SESSION_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(key) {
  const db = await openSessionDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(SESSION_STORE, "readonly");
      const request = tx.objectStore(SESSION_STORE).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function idbSet(key, value) {
  const db = await openSessionDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(SESSION_STORE, "readwrite");
      tx.objectStore(SESSION_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function idbDelete(key) {
  const db = await openSessionDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(SESSION_STORE, "readwrite");
      tx.objectStore(SESSION_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function setStatus(message) {
  statusLine.textContent = message;
}

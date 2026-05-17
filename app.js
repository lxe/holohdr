const PREVIEW_MAX_SIDE = 1800;
const EXPORT_MIME = "image/jpeg";
const JPEG_QUALITY = 0.96;
const ORIGINAL_PEEK_DELAY_MS = 10;
const DOUBLE_TAP_MS = 280;
const DOUBLE_TAP_DISTANCE = 28;
const TAP_MOVE_TOLERANCE = 12;
const HDR_PREVIEW_DEBOUNCE_MS = 160;
const STATIC_ASSET_VERSION = "20260517z";
const HDR_COLOR_BASE_STRENGTH = 0.18;
const HDR_COLOR_MAX_DELTA = 0.28;
const HDR_COLOR_RESPONSE_FLOOR = 0.06;
const SESSION_DB_NAME = "hdr-gainmap-tuner";
const SESSION_DB_VERSION = 1;
const SESSION_STORE = "session";
const SESSION_KEY = "last";
const CUSTOM_PRESETS_KEY = "hdr-gainmap-custom-presets";

const sliders = [
  {
    key: "sdrExposure",
    label: "Exposure",
    min: -1,
    max: 1.5,
    step: 0.01,
    group: "tone",
    description: "Move right to brighten the entire image. Move left if whites, skies, or skin are clipping too early.",
  },
  {
    key: "sdrContrast",
    label: "Contrast",
    min: 0.5,
    max: 1.5,
    step: 0.01,
    group: "tone",
    description: "Move right for more punch between dark and light areas. Move left to soften harsh contrast and preserve color detail.",
  },
  {
    key: "sdrShadows",
    label: "Shadows",
    min: -1,
    max: 1,
    step: 0.01,
    group: "shadows",
    description: "Move right to brighten dark greens, purples, hair, and other shadow detail. Move left to make dark areas richer.",
  },
  {
    key: "sdrHighlights",
    label: "Highlights",
    min: -1,
    max: 1,
    step: 0.01,
    group: "highlights",
    description: "Move left to pull back bright clouds, sun, and white fabric before export. Move right to make bright areas pop more.",
  },
  {
    key: "sdrSaturation",
    label: "SDR color",
    min: 0,
    max: 2.5,
    step: 0.01,
    group: "color",
    description: "Controls color in the normal SDR image. Raise this when Instagram makes purples, greens, or flowers look dull.",
  },
  {
    key: "hdrSaturation",
    label: "HDR color",
    min: 0,
    max: 2.5,
    step: 0.01,
    group: "color",
    description: "Adds a subtle color bias mostly in areas receiving HDR lift. This is intentionally compressed so small slider moves do not turn into neon color.",
  },
  {
    key: "hdrHeadroom",
    label: "Headroom",
    min: 1,
    max: 12,
    step: 0.1,
    group: "headroom",
    description: "Sets how bright the HDR layer is allowed to get. Higher values make highlights glow harder but can blow out uploads.",
  },
  {
    key: "hdrBrightness",
    label: "HDR brightness",
    min: 1,
    max: 3,
    step: 0.01,
    group: "brightness",
    description: "Raises the whole HDR version of the image on HDR screens while leaving the normal SDR image unchanged.",
  },
  {
    key: "highlightThreshold",
    label: "Threshold",
    min: 0,
    max: 1,
    step: 0.01,
    group: "threshold",
    description: "Move left to let midtones get HDR lift. Move right so only the brightest parts, like sun and clouds, get boosted.",
  },
  {
    key: "highlightSoftness",
    label: "Softness",
    min: 0.01,
    max: 1,
    step: 0.01,
    group: "softness",
    description: "Move right for a smoother transition into HDR. Move left for a harder edge where boost starts.",
  },
  {
    key: "highlightPower",
    label: "Power",
    min: 0.1,
    max: 5,
    step: 0.01,
    group: "power",
    description: "Move left to brighten more of the image with HDR. Move right to keep HDR mostly on tiny, very bright highlights.",
  },
  {
    key: "gainmapGamma",
    label: "Gamma",
    min: 0.1,
    max: 4,
    step: 0.01,
    group: "gamma",
    description: "Move lower to bring HDR lift into midtones sooner. Move higher to keep the boost concentrated near peak highlights.",
  },
];

const neutralSettings = {
  sdrExposure: 0,
  sdrContrast: 1,
  sdrShadows: 0,
  sdrHighlights: 0,
  sdrSaturation: 1,
  hdrHeadroom: 1,
  hdrBrightness: 1,
  highlightThreshold: 0.5,
  highlightSoftness: 0.5,
  highlightPower: 1,
  hdrSaturation: 1,
  gainmapGamma: 1,
};

const NEUTRAL_SETTING_EPSILON = 0.000001;

const presets = {
  reset: neutralSettings,
  custom: null,
  vibrant: {
    sdrExposure: 0.12,
    sdrContrast: 0.95,
    sdrShadows: 0.18,
    sdrHighlights: -0.12,
    sdrSaturation: 1.18,
    hdrHeadroom: 3.8,
    hdrBrightness: 1,
    highlightThreshold: 0.26,
    highlightSoftness: 0.68,
    highlightPower: 0.78,
    hdrSaturation: 1.06,
    gainmapGamma: 0.9,
  },
  holosomnia: {
    sdrExposure: 0.08,
    sdrContrast: 0.98,
    sdrShadows: 0.12,
    sdrHighlights: -0.08,
    sdrSaturation: 1.14,
    hdrHeadroom: 4.2,
    hdrBrightness: 1.02,
    highlightThreshold: 0.28,
    highlightSoftness: 0.62,
    highlightPower: 0.85,
    hdrSaturation: 1.08,
    gainmapGamma: 0.9,
  },
  instagram_safe: {
    sdrExposure: 0,
    sdrContrast: 1,
    sdrShadows: 0,
    sdrHighlights: 0,
    sdrSaturation: 1,
    hdrHeadroom: 3,
    hdrBrightness: 1,
    highlightThreshold: 0.55,
    highlightSoftness: 0.35,
    highlightPower: 1.25,
    hdrSaturation: 1.02,
    gainmapGamma: 1,
  },
  instagram_bright: {
    sdrExposure: 0.04,
    sdrContrast: 0.97,
    sdrShadows: 0.08,
    sdrHighlights: -0.05,
    sdrSaturation: 1.08,
    hdrHeadroom: 3.6,
    hdrBrightness: 1.02,
    highlightThreshold: 0.34,
    highlightSoftness: 0.52,
    highlightPower: 0.95,
    hdrSaturation: 1.04,
    gainmapGamma: 0.95,
  },
  instagram_blast: {
    sdrExposure: 0.06,
    sdrContrast: 0.96,
    sdrShadows: 0.12,
    sdrHighlights: -0.1,
    sdrSaturation: 1.12,
    hdrHeadroom: 4.8,
    hdrBrightness: 1.04,
    highlightThreshold: 0.24,
    highlightSoftness: 0.66,
    highlightPower: 0.76,
    hdrSaturation: 1.08,
    gainmapGamma: 0.85,
  },
};

const presetLabels = {
  reset: "Reset",
  vibrant: "Vibrant recovery",
  holosomnia: "Holosomnia",
  instagram_safe: "Instagram safe",
  instagram_bright: "Instagram bright",
  instagram_blast: "Instagram blast",
  custom: "Custom",
};
const presetOrder = ["custom", "reset", "vibrant", "holosomnia", "instagram_safe", "instagram_bright", "instagram_blast"];

const autoModes = {
  balanced: "Even",
  vibrant: "Color",
  social: "Social",
  glow: "Glow",
  shadows: "Dark",
};

let customPresets = loadCustomPresets();
let ultraHdrWasmPromise = null;
let ultraHdrWorker = null;
let ultraHdrWorkerFailed = false;
let ultraHdrWorkerSeq = 0;
const ultraHdrWorkerJobs = new Map();

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
  settings: { ...neutralSettings },
  renderToken: 0,
  hdrPreviewUrl: null,
  hdrPreviewKey: "",
  hdrPreviewTimer: 0,
  controlsOpen: false,
  activeTool: "look",
  ultraHdrAvailable: false,
};

const gesture = {
  pointers: new Map(),
  longPressTimer: 0,
  longPressStart: null,
  panStart: null,
  pinchStart: null,
  lastTapAt: 0,
  lastTapPoint: null,
  zoomAnimationTimer: 0,
  suppressClick: false,
};

const fileInput = document.getElementById("fileInput");
const previewCanvas = document.getElementById("previewCanvas");
const hdrPreviewImage = document.getElementById("hdrPreviewImage");
const emptyState = document.getElementById("emptyState");
const imageMeta = document.getElementById("imageMeta");
const controlsPanel = document.getElementById("controlsPanel");
const toolPanel = document.getElementById("toolPanel");
const toolRailShell = document.getElementById("toolRailShell");
const toolRail = document.getElementById("toolRail");
const presetSelect = document.getElementById("presetSelect");
const applyPreset = document.getElementById("applyPreset");
const savePreset = document.getElementById("savePreset");
const autoSummary = document.getElementById("autoSummary");
const sliderStacks = {
  tone: document.getElementById("toneSliderStack"),
  shadows: document.getElementById("shadowsSliderStack"),
  highlights: document.getElementById("highlightsSliderStack"),
  color: document.getElementById("colorSliderStack"),
  headroom: document.getElementById("headroomSliderStack"),
  brightness: document.getElementById("brightnessSliderStack"),
  threshold: document.getElementById("thresholdSliderStack"),
  softness: document.getElementById("softnessSliderStack"),
  power: document.getElementById("powerSliderStack"),
  gamma: document.getElementById("gammaSliderStack"),
};
const exportSize = document.getElementById("exportSize");
const exportUltra = document.getElementById("exportUltra");
const exportJpeg = document.getElementById("exportJpeg");
const exportGain = document.getElementById("exportGain");
const menuOpen = document.getElementById("menuOpen");
const menuClear = document.getElementById("menuClear");
const menuHelp = document.getElementById("menuHelp");
const helpOverlay = document.getElementById("helpOverlay");
const closeHelp = document.getElementById("closeHelp");
const previewCtx = previewCanvas.getContext("2d", { willReadFrequently: true });

renderPresetOptions();
buildControls();
applySettingsToControls();
updateRailFades();
checkExportCapabilities();
restoreSession();

fileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  if (!file) return;
  await loadFile(file);
  fileInput.value = "";
});

presetSelect.addEventListener("change", () => {
  saveSessionSoon();
});
applyPreset.addEventListener("click", applySelectedPreset);
savePreset.addEventListener("click", saveCurrentPreset);

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
menuHelp.addEventListener("click", openHelpOverlay);
closeHelp.addEventListener("click", closeHelpOverlay);
helpOverlay.addEventListener("click", (event) => {
  if (event.target === helpOverlay) closeHelpOverlay();
});
toolRail.addEventListener("scroll", updateRailFades, { passive: true });
window.addEventListener("resize", updateRailFades);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !helpOverlay.hidden) closeHelpOverlay();
});
document.querySelectorAll("[data-auto-mode]").forEach((button) => {
  button.addEventListener("click", () => applyAutoTune(button.dataset.autoMode));
});
document.querySelectorAll(".tool-button").forEach((button) => {
  button.addEventListener("click", () => {
    const wasOpen = controlsPanel.classList.contains("open");
    const wasActive = button.classList.contains("active");
    setActiveTool(button.dataset.tool);
    button.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setControlsOpen(!(wasOpen && wasActive));
    schedulePreview();
    window.setTimeout(updateRailFades, 180);
  });
});
for (const target of [previewCanvas, hdrPreviewImage]) {
  target.addEventListener("click", () => {
    if (gesture.suppressClick) {
      gesture.suppressClick = false;
      return;
    }
    setControlsOpen(false);
  });
  target.addEventListener("pointerdown", beginPreviewGesture);
  target.addEventListener("pointermove", updatePreviewGesture);
  target.addEventListener("pointerup", endPreviewGesture);
  target.addEventListener("pointercancel", endPreviewGesture);
  target.addEventListener("contextmenu", (event) => event.preventDefault());
}
window.addEventListener("pointerup", endPreviewGesture);
window.addEventListener("pointercancel", endPreviewGesture);

function buildControls() {
  Object.values(sliderStacks).forEach((stack) => {
    stack.innerHTML = "";
  });
  for (const { key, label, min, max, step, group, description } of sliders) {
    const card = document.createElement("div");
    card.className = "slider-card";
    card.innerHTML = `
      <div class="slider-head">
        <div class="slider-label-block">
          <div class="slider-label-row">
            <label for="${key}">${label}</label>
            <button class="help-button" type="button" aria-expanded="false" aria-label="${label} help">?</button>
          </div>
          <p class="slider-description" hidden>${description}</p>
        </div>
        <span class="slider-value" id="${key}Value"></span>
      </div>
      <input id="${key}" type="range" min="${min}" max="${max}" step="${step}" />
    `;
    sliderStacks[group].appendChild(card);

    const help = card.querySelector(".help-button");
    const descriptionEl = card.querySelector(".slider-description");
    help.addEventListener("click", () => {
      const expanded = help.getAttribute("aria-expanded") === "true";
      document.querySelectorAll(".help-button[aria-expanded='true']").forEach((button) => {
        if (button === help) return;
        button.setAttribute("aria-expanded", "false");
        button.closest(".slider-card")?.querySelector(".slider-description")?.setAttribute("hidden", "");
      });
      help.setAttribute("aria-expanded", String(!expanded));
      descriptionEl.toggleAttribute("hidden", expanded);
    });

    const input = document.getElementById(key);
    input.addEventListener("input", () => {
      state.settings[key] = Number(input.value);
      markSettingsCustom();
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

function renderPresetOptions(selectedValue = presetSelect.value || "custom") {
  presetSelect.innerHTML = "";

  for (const key of presetOrder) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = presetLabels[key] || key;
    presetSelect.appendChild(option);
  }

  if (customPresets.length) {
    const group = document.createElement("optgroup");
    group.label = "Saved";
    for (const preset of customPresets) {
      const option = document.createElement("option");
      option.value = `saved:${preset.id}`;
      option.textContent = preset.name;
      group.appendChild(option);
    }
    presetSelect.appendChild(group);
  }

  const hasSelection = [...presetSelect.options].some((option) => option.value === selectedValue);
  presetSelect.value = hasSelection ? selectedValue : "custom";
}

function getPresetSettings(value) {
  if (value === "custom") return neutralSettings;
  if (presets[value]) return presets[value];
  if (!value.startsWith("saved:")) return null;
  const id = value.slice("saved:".length);
  return customPresets.find((preset) => preset.id === id)?.settings || null;
}

function applySelectedPreset() {
  const preset = getPresetSettings(presetSelect.value);
  if (!preset) return;
  state.settings = { ...neutralSettings, ...preset };
  clearAutoSelection();
  applySettingsToControls();
  schedulePreview();
  saveSessionSoon();
}

function saveCurrentPreset() {
  const fallbackName = getSuggestedPresetName();
  const name = window.prompt("Save current settings as:", fallbackName)?.trim();
  if (!name) return;

  const id = makePresetId(name);
  const saved = {
    id,
    name,
    settings: copyCurrentSettings(),
    savedAt: Date.now(),
  };
  const existingIndex = customPresets.findIndex((preset) => preset.id === id);
  if (existingIndex >= 0) customPresets[existingIndex] = saved;
  else customPresets.push(saved);
  customPresets.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  storeCustomPresets();
  renderPresetOptions(`saved:${id}`);
  clearAutoSelection();
  saveSessionSoon();
}

function markSettingsCustom() {
  presetSelect.value = "custom";
  clearAutoSelection();
}

function copyCurrentSettings() {
  return Object.fromEntries(sliders.map(({ key }) => [key, state.settings[key]]));
}

function getSuggestedPresetName() {
  const selected = presetSelect.options[presetSelect.selectedIndex]?.textContent?.trim();
  if (selected && selected !== "Custom") return `${selected} copy`;
  return "My preset";
}

function makePresetId(name) {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `preset-${Date.now()}`;
}

function loadCustomPresets() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CUSTOM_PRESETS_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((preset) => preset?.id && preset?.name && preset?.settings)
      .map((preset) => ({
        id: String(preset.id),
        name: String(preset.name),
        settings: clampSettingsToSliderRanges(preset.settings),
        savedAt: Number(preset.savedAt) || 0,
      }));
  } catch (error) {
    console.warn("Could not load saved presets", error);
    return [];
  }
}

function storeCustomPresets() {
  try {
    window.localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(customPresets));
  } catch (error) {
    console.warn("Could not save preset", error);
  }
}

function updateValueLabel(key) {
  document.getElementById(`${key}Value`).textContent = Number(state.settings[key]).toFixed(2);
}

async function loadFile(file) {
  setStatus("Loading image...");
  try {
    const dataUrl = await fileToDataUrl(file);
    resetAdjustmentsForNewImage();
    await loadImageDataUrl(dataUrl, file.name.replace(/\.[^.]+$/, "") || "image");
    await saveSession();
    setStatus("Ready");
  } catch (error) {
    console.error(error);
    setStatus("Could not load that image.");
  }
}

function resetAdjustmentsForNewImage() {
  state.settings = { ...neutralSettings };
  markSettingsCustom();
  applySettingsToControls();
}

async function loadImageDataUrl(dataUrl, sourceName) {
  const img = await decodeImage(dataUrl);
  state.sourceImage = img;
  state.sourceDataUrl = dataUrl;
  state.sourceName = sourceName || "image";
  state.previewSource = makeSourceCanvas(img, PREVIEW_MAX_SIDE);
  state.peekingOriginal = false;
  clearHdrPreview();
  resetImageTransform();

  imageMeta.textContent = `${img.naturalWidth} x ${img.naturalHeight}`;
  emptyState.style.display = "none";
  if (isTrueHdrPreviewActive()) {
    previewCanvas.style.display = "none";
    hdrPreviewImage.style.display = "none";
  } else {
    showCanvasPreview();
  }
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
  state.controlsOpen = open;
  controlsPanel.classList.toggle("open", open);
  toolPanel.setAttribute("aria-hidden", String(!open));
  if (!isTrueHdrPreviewActive()) showCanvasPreview();
}

function updateRailFades() {
  const maxScroll = toolRail.scrollWidth - toolRail.clientWidth;
  toolRailShell.classList.toggle("can-scroll-left", toolRail.scrollLeft > 2);
  toolRailShell.classList.toggle("can-scroll-right", toolRail.scrollLeft < maxScroll - 2);
}

function setActiveTool(tool) {
  state.activeTool = tool;
  document.querySelectorAll(".tool-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tool === tool);
  });
  document.querySelectorAll(".tool-section").forEach((section) => {
    section.classList.toggle("active", section.dataset.section === tool);
  });
  if (!isTrueHdrPreviewActive()) showCanvasPreview();
}

function openHelpOverlay() {
  helpOverlay.hidden = false;
  closeHelp.focus();
}

function closeHelpOverlay() {
  helpOverlay.hidden = true;
  menuHelp.focus();
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
  clearHdrPreview();
  resetImageTransform();
  imageMeta.textContent = "No image loaded";
  previewCanvas.style.display = "none";
  hdrPreviewImage.style.display = "none";
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
  exportUltra.disabled = !enabled || !state.ultraHdrAvailable;
  exportJpeg.disabled = !enabled;
  exportGain.disabled = !enabled;
  menuClear.disabled = !enabled;
}

function checkExportCapabilities() {
  state.ultraHdrAvailable = Boolean(window.WebAssembly);
  exportUltra.title = state.ultraHdrAvailable ? "" : "Ultra HDR export requires WebAssembly support.";
  setImageActionsEnabled(Boolean(state.sourceImage));
}

function setPreviewMode(mode) {
  if (mode !== "hdr" && mode !== "sdr") mode = "hdr";
  state.previewMode = mode;
  document.querySelectorAll(".segment").forEach((item) => {
    item.classList.toggle("active", item.dataset.mode === mode);
  });
  if (isTrueHdrPreviewActive()) showHdrPreviewIfCurrent();
  else showCanvasPreview();
}

function applyAutoTune(mode) {
  if (!state.previewSource) {
    setStatus("Open an image first.");
    if (autoSummary) autoSummary.textContent = "Open an image, then choose a wand pass.";
    openImagePicker();
    return;
  }

  const analysis = analyzeImageForAutoTune();
  const settings = makeAutoSettings(mode, analysis);
  state.settings = { ...state.settings, ...settings };
  presetSelect.value = "custom";
  document.querySelectorAll("[data-auto-mode]").forEach((button) => {
    button.classList.toggle("selected", button.dataset.autoMode === mode);
  });
  applySettingsToControls();
  schedulePreview();
  saveSessionSoon();

  const label = autoModes[mode] || "Auto";
  const summary = summarizeAutoTune(label, analysis, settings);
  if (autoSummary) autoSummary.textContent = summary;
  setStatus(`${label} auto tune applied`);
}

function clearAutoSelection() {
  document.querySelectorAll("[data-auto-mode].selected").forEach((button) => {
    button.classList.remove("selected");
  });
}

function analyzeImageForAutoTune() {
  const source = state.previewSource;
  const maxSide = 360;
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, width, height);

  const data = ctx.getImageData(0, 0, width, height).data;
  const pixelCount = data.length / 4;
  const luminance = new Float32Array(pixelCount);
  let satSum = 0;
  let shadowSatSum = 0;
  let shadowCount = 0;
  let highlightSatSum = 0;
  let highlightCount = 0;
  let darkCount = 0;
  let brightCount = 0;
  let nearWhiteCount = 0;

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const y = luma(r, g, b);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max <= 0 ? 0 : (max - min) / max;

    luminance[p] = y;
    satSum += sat;
    if (y < 0.36) {
      shadowSatSum += sat;
      shadowCount += 1;
    }
    if (y > 0.66) {
      highlightSatSum += sat;
      highlightCount += 1;
    }
    if (y < 0.16) darkCount += 1;
    if (y > 0.72) brightCount += 1;
    if (y > 0.96 && max > 0.98) nearWhiteCount += 1;
  }

  luminance.sort();
  const p05 = percentile(luminance, 0.05);
  const p10 = percentile(luminance, 0.1);
  const p25 = percentile(luminance, 0.25);
  const p50 = percentile(luminance, 0.5);
  const p75 = percentile(luminance, 0.75);
  const p90 = percentile(luminance, 0.9);
  const p95 = percentile(luminance, 0.95);
  const p99 = percentile(luminance, 0.99);

  return {
    p05,
    p10,
    p25,
    p50,
    p75,
    p90,
    p95,
    p99,
    range: p90 - p10,
    avgSat: satSum / pixelCount,
    shadowSat: shadowCount ? shadowSatSum / shadowCount : 0,
    highlightSat: highlightCount ? highlightSatSum / highlightCount : 0,
    darkFraction: darkCount / pixelCount,
    brightFraction: brightCount / pixelCount,
    nearWhiteFraction: nearWhiteCount / pixelCount,
  };
}

function makeAutoSettings(mode, analysis) {
  const highStart = srgbToLinear(clamp(analysis.p75 + (analysis.brightFraction > 0.22 ? 0.08 : 0.02), 0.46, 0.78));
  const flatImage = analysis.range < 0.46;
  const darkImage = analysis.p50 < 0.42 || analysis.darkFraction > 0.32;
  const brightImage = analysis.p50 > 0.62 || analysis.nearWhiteFraction > 0.035;

  const settings = {
    sdrExposure: clamp((0.5 - analysis.p50) * 0.46, -0.16, 0.18),
    sdrContrast: clamp(1 + (0.48 - analysis.range) * 0.32, 0.9, 1.08),
    sdrShadows: clamp((0.24 - analysis.p25) * 0.82 + analysis.shadowSat * 0.08, -0.06, 0.24),
    sdrHighlights: clamp(brightImage ? -0.06 - analysis.nearWhiteFraction * 1.2 : -Math.max(0, analysis.p95 - 0.88) * 0.55, -0.24, 0.04),
    sdrSaturation: clamp(1.04 + (0.26 - analysis.avgSat) * 0.24 + analysis.shadowSat * 0.12, 0.98, 1.18),
    hdrHeadroom: clamp(3.2 + (1 - analysis.brightFraction) * 0.8 - analysis.nearWhiteFraction * 5, 2.4, 4.2),
    hdrBrightness: clamp(1.02 + (0.52 - analysis.p50) * 0.12 - analysis.nearWhiteFraction * 0.7, 1, 1.08),
    highlightThreshold: clamp(highStart, 0.24, 0.58),
    highlightSoftness: clamp(0.46 + analysis.brightFraction * 0.62 + (flatImage ? 0.08 : 0), 0.36, 0.68),
    highlightPower: clamp(1.04 + analysis.brightFraction * 0.55 - (flatImage ? 0.12 : 0), 0.82, 1.38),
    hdrSaturation: clamp(1.02 + (0.2 - analysis.highlightSat) * 0.08, 1, 1.06),
    gainmapGamma: clamp(1.02 + analysis.brightFraction * 0.2, 0.88, 1.18),
  };

  if (darkImage) {
    settings.sdrShadows += 0.05;
    settings.sdrExposure += 0.03;
    settings.sdrContrast -= 0.03;
  }

  if (mode === "vibrant") {
    settings.sdrSaturation += 0.09;
    settings.hdrSaturation += 0.02;
    settings.hdrBrightness += 0.02;
    settings.sdrShadows += 0.04;
    settings.highlightThreshold -= 0.035;
    settings.gainmapGamma -= 0.08;
  } else if (mode === "social") {
    settings.hdrHeadroom -= 0.48;
    settings.hdrBrightness -= 0.02;
    settings.highlightThreshold += 0.07;
    settings.highlightPower += 0.16;
    settings.highlightSoftness -= 0.04;
    settings.sdrHighlights -= 0.04;
    settings.hdrSaturation -= 0.04;
  } else if (mode === "glow") {
    settings.hdrHeadroom += 0.62;
    settings.hdrBrightness += 0.06;
    settings.highlightThreshold -= 0.055;
    settings.highlightSoftness += 0.08;
    settings.highlightPower -= 0.18;
    settings.hdrSaturation += 0.025;
    settings.sdrHighlights -= 0.04;
    settings.gainmapGamma -= 0.08;
  } else if (mode === "shadows") {
    settings.sdrShadows += 0.16;
    settings.sdrExposure += 0.035;
    settings.sdrContrast -= 0.05;
    settings.sdrSaturation += 0.06;
    settings.sdrHighlights -= 0.035;
    settings.hdrHeadroom -= 0.22;
    settings.hdrBrightness += 0.02;
  }

  return clampSettingsToSliderRanges(settings);
}

function clampSettingsToSliderRanges(settings) {
  const limits = Object.fromEntries(sliders.map(({ key, min, max }) => [key, { min, max }]));
  return Object.fromEntries(
    Object.entries(settings).map(([key, value]) => {
      const limit = limits[key];
      return [key, limit ? clamp(value, limit.min, limit.max) : value];
    }),
  );
}

function summarizeAutoTune(label, analysis, settings) {
  const shadowLift = settings.sdrShadows > 0.08 ? " lifted shadows" : " held shadows";
  const highlightPlan = settings.sdrHighlights < -0.08 ? " pulled back whites" : " kept whites close";
  const colorPlan = settings.sdrSaturation > 1.12 ? " raised color" : " kept color moderate";
  const brightness = analysis.p50 < 0.42 ? "dark" : analysis.p50 > 0.62 ? "bright" : "balanced";
  return `${label}: ${brightness} image,${shadowLift},${highlightPlan},${colorPlan}.`;
}

function beginPreviewGesture(event) {
  if (!state.previewSource || event.button > 0) return;
  event.preventDefault();
  event.currentTarget.setPointerCapture?.(event.pointerId);

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
  event.currentTarget.releasePointerCapture?.(event.pointerId);
  const wasSinglePointer = gesture.pointers.size === 1;
  const start = gesture.longPressStart;
  const point = pointFromEvent(event);
  const tapCandidate = wasSinglePointer && start && pointDistance(start, point) <= TAP_MOVE_TOLERANCE && !gesture.pinchStart;
  gesture.pointers.delete(event.pointerId);
  clearLongPressTimer();
  stopOriginalPeek();

  if (tapCandidate) {
    handlePreviewTap(point);
  }

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

function handlePreviewTap(point) {
  const now = performance.now();
  const doubleTap =
    gesture.lastTapPoint &&
    now - gesture.lastTapAt <= DOUBLE_TAP_MS &&
    pointDistance(point, gesture.lastTapPoint) <= DOUBLE_TAP_DISTANCE;

  gesture.lastTapAt = now;
  gesture.lastTapPoint = point;

  if (!doubleTap) return;
  gesture.lastTapAt = 0;
  gesture.lastTapPoint = null;
  gesture.suppressClick = true;
  toggleCoverZoom();
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

function resetImageTransform(animated = false) {
  state.viewScale = 1;
  state.viewX = 0;
  state.viewY = 0;
  applyImageTransform(animated);
}

function toggleCoverZoom() {
  if (state.viewScale > 1.01) {
    resetImageTransform(true);
    return;
  }

  const coverScale = getCoverScale();
  if (coverScale <= 1.01) {
    resetImageTransform(true);
    return;
  }

  state.viewScale = coverScale;
  state.viewX = 0;
  state.viewY = 0;
  applyImageTransform(true);
  if (window.matchMedia("(max-width: 860px)").matches) setControlsOpen(false);
}

function getCoverScale() {
  const element = activePreviewElement();
  const frame = element.parentElement;
  const width = element.clientWidth;
  const height = element.clientHeight;
  if (!frame || width <= 0 || height <= 0) return 1;
  return clamp(Math.max(frame.clientWidth / width, frame.clientHeight / height), 1, 5);
}

function applyImageTransform(animated = false) {
  const transform = `translate3d(${state.viewX}px, ${state.viewY}px, 0) scale(${state.viewScale})`;
  if (animated) {
    previewCanvas.classList.add("zoom-animating");
    hdrPreviewImage.classList.add("zoom-animating");
    window.clearTimeout(gesture.zoomAnimationTimer);
    gesture.zoomAnimationTimer = window.setTimeout(() => {
      previewCanvas.classList.remove("zoom-animating");
      hdrPreviewImage.classList.remove("zoom-animating");
    }, 190);
  }
  previewCanvas.style.transform = transform;
  hdrPreviewImage.style.transform = transform;
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

function activePreviewElement() {
  return hdrPreviewImage.style.display === "block" ? hdrPreviewImage : previewCanvas;
}

function showCanvasPreview() {
  if (!state.previewSource) return;
  previewCanvas.style.display = "block";
  previewCanvas.style.opacity = "1";
  hdrPreviewImage.style.display = "none";
  hdrPreviewImage.style.opacity = "1";
  applyImageTransform();
}

function showHdrPreview() {
  if (!state.previewSource || !hdrPreviewImage.src) return;
  previewCanvas.style.display = "none";
  previewCanvas.style.opacity = "1";
  hdrPreviewImage.style.display = "block";
  hdrPreviewImage.style.opacity = "1";
  applyImageTransform();
}

function showOriginalPreview() {
  if (!state.previewSource) return;
  previewCanvas.style.display = "block";
  previewCanvas.style.opacity = "1";
  if (hdrPreviewImage.src) {
    hdrPreviewImage.style.display = "block";
    hdrPreviewImage.style.opacity = "0";
  } else {
    hdrPreviewImage.style.display = "none";
    hdrPreviewImage.style.opacity = "1";
  }
  applyImageTransform();
}

function showHdrPreviewIfCurrent() {
  if (state.previewSource && state.hdrPreviewUrl && state.hdrPreviewKey === makeHdrPreviewKey()) {
    showHdrPreview();
    return;
  }
  previewCanvas.style.display = "none";
  hdrPreviewImage.style.display = "none";
  applyImageTransform();
}

function clearHdrPreview() {
  window.clearTimeout(state.hdrPreviewTimer);
  state.hdrPreviewTimer = 0;
  state.hdrPreviewKey = "";
  if (state.hdrPreviewUrl) URL.revokeObjectURL(state.hdrPreviewUrl);
  state.hdrPreviewUrl = null;
  hdrPreviewImage.removeAttribute("src");
  hdrPreviewImage.style.display = "none";
}

function isTrueHdrPreviewActive() {
  return state.previewMode === "hdr" && state.ultraHdrAvailable && Boolean(state.previewSource);
}

function schedulePreview() {
  if (!state.previewSource) return;
  window.clearTimeout(state.hdrPreviewTimer);
  const token = ++state.renderToken;
  if (isTrueHdrPreviewActive() && !state.peekingOriginal) {
    if (state.hdrPreviewUrl && state.hdrPreviewKey === makeHdrPreviewKey()) {
      showHdrPreview();
      return;
    }
    state.hdrPreviewTimer = window.setTimeout(() => {
      renderTrueHdrPreview(token).catch((error) => {
        console.warn("True HDR preview failed", error);
      });
    }, HDR_PREVIEW_DEBOUNCE_MS);
    return;
  }

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
    showOriginalPreview();
    return;
  }
  showCanvasPreview();

  const imageData = previewCtx.getImageData(0, 0, source.width, source.height);
  processPixels(imageData.data, state.settings, state.previewMode);
  previewCtx.putImageData(imageData, 0, 0);
}

async function renderTrueHdrPreview(token) {
  if (token !== state.renderToken || !isTrueHdrPreviewActive() || state.peekingOriginal || !state.previewSource) return;

  const key = makeHdrPreviewKey();
  if (state.hdrPreviewUrl && state.hdrPreviewKey === key) {
    showHdrPreview();
    return;
  }

  const input = await makeUltraHdrEncodeInput(PREVIEW_MAX_SIDE);
  if (token !== state.renderToken || !isTrueHdrPreviewActive() || state.peekingOriginal || !state.previewSource) return;

  const blob = await encodeUltraHdrBlob(input, { gainMapScale: 4, realtime: true });
  const url = URL.createObjectURL(blob);
  await loadHdrPreviewUrl(url);
  if (token !== state.renderToken || !isTrueHdrPreviewActive() || state.peekingOriginal || !state.previewSource) {
    URL.revokeObjectURL(url);
    return;
  }

  if (state.hdrPreviewUrl) URL.revokeObjectURL(state.hdrPreviewUrl);
  state.hdrPreviewUrl = url;
  state.hdrPreviewKey = key;
  hdrPreviewImage.src = url;
  showHdrPreview();
}

function makeHdrPreviewKey() {
  const source = state.previewSource;
  return `${source.width}x${source.height}:${JSON.stringify(state.settings)}`;
}

function loadHdrPreviewUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("HDR preview decode failed"));
    img.decoding = "async";
    img.src = url;
  });
}

async function exportProcessed(kind) {
  if (!state.sourceImage) return;
  const token = ++state.renderToken;
  setStatus("Rendering export...");
  await nextFrame();
  if (token !== state.renderToken) return;

  const maxSide = selectedExportMaxSide();
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
  if (!state.sourceImage) return;
  setStatus("Rendering Ultra HDR...");
  try {
    const token = ++state.renderToken;
    await nextFrame();
    if (token !== state.renderToken) return;

    const input = await makeUltraHdrEncodeInput();
    if (token !== state.renderToken) return;

    const blob = await encodeUltraHdrBlob(input);
    downloadBlob(blob, `${state.sourceName}-ultrahdr.jpg`);
    setStatus(`Exported Ultra HDR JPEG ${input.width} x ${input.height}`);
  } catch (error) {
    console.error(error);
    setStatus("Ultra HDR export failed.");
  }
}

async function getUltraHdrWasm() {
  if (!ultraHdrWasmPromise) {
    ultraHdrWasmPromise = import(`./vendor/open-ultrahdr/open_ultrahdr.js?v=${STATIC_ASSET_VERSION}`).then(({ default: createModule }) =>
      createModule({
        locateFile: (path) =>
          path.endsWith(".wasm") ? `./vendor/open-ultrahdr/open_ultrahdr.wasm?v=${STATIC_ASSET_VERSION}` : path,
      }),
    );
  }
  return ultraHdrWasmPromise;
}

function selectedExportMaxSide() {
  if (exportSize.value === "full") return Infinity;
  if (exportSize.value === "preview") return PREVIEW_MAX_SIDE;
  return Number(exportSize.value);
}

function makeUltraHdrOptions(options = {}) {
  const targetHdrCapacity = getTargetHdrCapacity();
  return {
    baseQuality: 95,
    gainMapQuality: 95,
    targetHdrCapacity: clamp(targetHdrCapacity, 0, 6),
    includeIsoMetadata: true,
    includeUltrahdrV1: true,
    gainMapScale: options.gainMapScale ?? 1,
    realtime: options.realtime ?? false,
    multiChannelGainMap: options.multiChannelGainMap ?? false,
  };
}

function getTargetHdrCapacity(settings = state.settings) {
  const headroomStops = Math.log2(Math.max(1, settings.hdrHeadroom ?? neutralSettings.hdrHeadroom));
  const brightnessStops = Math.log2(Math.max(1, settings.hdrBrightness ?? neutralSettings.hdrBrightness));
  const hdrColor = settings.hdrSaturation ?? neutralSettings.hdrSaturation;
  const colorStops =
    Math.abs(hdrColor - neutralSettings.hdrSaturation) > NEUTRAL_SETTING_EPSILON
      ? Math.max(0.25, Math.log2(Math.max(1, getEffectiveHdrSaturation(settings))))
      : 0;
  return clamp(Math.max(headroomStops, brightnessStops, colorStops), 0, 6);
}

function getEffectiveHdrSaturation(settings = state.settings) {
  const raw = settings.hdrSaturation ?? neutralSettings.hdrSaturation;
  const delta = raw - neutralSettings.hdrSaturation;
  if (Math.abs(delta) <= NEUTRAL_SETTING_EPSILON) return neutralSettings.hdrSaturation;
  const compressed = (1 - Math.exp(-Math.abs(delta) * 0.7)) * HDR_COLOR_MAX_DELTA;
  return neutralSettings.hdrSaturation + Math.sign(delta) * compressed;
}

async function encodeUltraHdrBlob(input, options = {}) {
  const outputBuffer = await encodeUltraHdrBuffer(input, makeUltraHdrOptions(options));
  return new Blob([outputBuffer], { type: "image/jpeg" });
}

async function encodeUltraHdrBuffer(input, options) {
  if (window.Worker && !ultraHdrWorkerFailed) {
    try {
      return encodeUltraHdrInWorker(input, options);
    } catch (error) {
      ultraHdrWorkerFailed = true;
      console.warn("Ultra HDR worker unavailable", error);
    }
  }
  return encodeUltraHdrOnMain(input, options);
}

function encodeUltraHdrInWorker(input, options) {
  const worker = getUltraHdrWorker();
  const id = ++ultraHdrWorkerSeq;
  return new Promise((resolve, reject) => {
    ultraHdrWorkerJobs.set(id, { resolve, reject });
    worker.postMessage(
      {
        id,
        sdrBuffer: input.sdrBuffer,
        hdrBuffer: input.hdrBuffer.buffer,
        options,
      },
      [input.sdrBuffer, input.hdrBuffer.buffer],
    );
  });
}

function getUltraHdrWorker() {
  if (ultraHdrWorker) return ultraHdrWorker;

  ultraHdrWorker = new Worker(`./ultrahdr-worker.js?v=${STATIC_ASSET_VERSION}`, { type: "module" });
  ultraHdrWorker.addEventListener("message", (event) => {
    const { id, outputBuffer, error } = event.data || {};
    const job = ultraHdrWorkerJobs.get(id);
    if (!job) return;
    ultraHdrWorkerJobs.delete(id);
    if (error) job.reject(new Error(error));
    else job.resolve(outputBuffer);
  });
  ultraHdrWorker.addEventListener("error", (error) => {
    ultraHdrWorkerFailed = true;
    for (const job of ultraHdrWorkerJobs.values()) {
      job.reject(error instanceof Error ? error : new Error("Ultra HDR worker failed."));
    }
    ultraHdrWorkerJobs.clear();
    ultraHdrWorker?.terminate();
    ultraHdrWorker = null;
  });
  return ultraHdrWorker;
}

async function encodeUltraHdrOnMain(input, options) {
  const wasm = await getUltraHdrWasm();
  const encoded = wasm.encodeUltraHdr(new Uint8Array(input.sdrBuffer), input.hdrBuffer, options);
  return encoded.slice().buffer;
}

async function makeUltraHdrEncodeInput(maxSide = selectedExportMaxSide()) {
  const source = makeSourceCanvas(state.sourceImage, maxSide);
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const hdrBuffer = new Float32Array(canvas.width * canvas.height * 3);
  fillSdrAndHdrBuffers(imageData.data, hdrBuffer, state.settings);
  ctx.putImageData(imageData, 0, 0);

  const sdrBlob = await canvasToBlob(canvas, EXPORT_MIME, JPEG_QUALITY);
  return {
    sdrBuffer: await sdrBlob.arrayBuffer(),
    hdrBuffer,
    width: canvas.width,
    height: canvas.height,
  };
}

function fillSdrAndHdrBuffers(data, hdrBuffer, settings) {
  const exposure = 2 ** settings.sdrExposure;
  const contrast = settings.sdrContrast;
  const shadows = settings.sdrShadows ?? 0;
  const highlights = settings.sdrHighlights ?? 0;
  const sdrSat = settings.sdrSaturation;
  const threshold = settings.highlightThreshold;
  const softness = settings.highlightSoftness;
  const power = settings.highlightPower;
  const headroom = settings.hdrHeadroom;
  const hdrBrightness = settings.hdrBrightness ?? neutralSettings.hdrBrightness;
  const hdrSat = getEffectiveHdrSaturation(settings);
  const gamma = settings.gainmapGamma;

  for (let i = 0, h = 0; i < data.length; i += 4, h += 3) {
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

    let lr = srgbToLinear(r);
    let lg = srgbToLinear(g);
    let lb = srgbToLinear(b);
    const ll = luma(lr, lg, lb);
    let mask = smoothstep(threshold, threshold + softness, ll);
    mask = Math.pow(clamp01(mask), power);
    const gainResponse = Math.pow(mask, 1 / gamma);
    const colorResponse = HDR_COLOR_RESPONSE_FLOOR + gainResponse * (1 - HDR_COLOR_RESPONSE_FLOOR);

    const baseHdrSat = 1 + (hdrSat - 1) * colorResponse * HDR_COLOR_BASE_STRENGTH;
    if (Math.abs(baseHdrSat - 1) > NEUTRAL_SETTING_EPSILON) {
      const baseLuma = luma(r, g, b);
      r = clamp01(baseLuma + (r - baseLuma) * baseHdrSat);
      g = clamp01(baseLuma + (g - baseLuma) * baseHdrSat);
      b = clamp01(baseLuma + (b - baseLuma) * baseHdrSat);
      lr = srgbToLinear(r);
      lg = srgbToLinear(g);
      lb = srgbToLinear(b);
    }

    const boost = 1 + (headroom - 1) * gainResponse;
    let hr = lr * boost;
    let hg = lg * boost;
    let hb = lb * boost;
    const hl = luma(hr, hg, hb);
    const sat = 1 + (hdrSat - 1) * colorResponse * (1 - HDR_COLOR_BASE_STRENGTH);
    hr = Math.max(0, hl + (hr - hl) * sat);
    hg = Math.max(0, hl + (hg - hl) * sat);
    hb = Math.max(0, hl + (hb - hl) * sat);
    hr *= hdrBrightness;
    hg *= hdrBrightness;
    hb *= hdrBrightness;

    data[i] = Math.round(r * 255);
    data[i + 1] = Math.round(g * 255);
    data[i + 2] = Math.round(b * 255);
    hdrBuffer[h] = hr;
    hdrBuffer[h + 1] = hg;
    hdrBuffer[h + 2] = hb;
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
  const hdrBrightness = settings.hdrBrightness ?? neutralSettings.hdrBrightness;
  const hdrSat = getEffectiveHdrSaturation(settings);
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

    let lr = srgbToLinear(r);
    let lg = srgbToLinear(g);
    let lb = srgbToLinear(b);
    const ll = luma(lr, lg, lb);
    let mask = smoothstep(threshold, threshold + softness, ll);
    mask = Math.pow(clamp01(mask), power);
    const gainResponse = Math.pow(mask, 1 / gamma);
    const colorResponse = HDR_COLOR_RESPONSE_FLOOR + gainResponse * (1 - HDR_COLOR_RESPONSE_FLOOR);

    if (mode === "hdr") {
      const baseHdrSat = 1 + (hdrSat - 1) * colorResponse * HDR_COLOR_BASE_STRENGTH;
      if (Math.abs(baseHdrSat - 1) > NEUTRAL_SETTING_EPSILON) {
        const baseLuma = luma(r, g, b);
        r = clamp01(baseLuma + (r - baseLuma) * baseHdrSat);
        g = clamp01(baseLuma + (g - baseLuma) * baseHdrSat);
        b = clamp01(baseLuma + (b - baseLuma) * baseHdrSat);
        lr = srgbToLinear(r);
        lg = srgbToLinear(g);
        lb = srgbToLinear(b);
      }
    }

    const boost = 1 + (headroom - 1) * gainResponse;
    let hr = lr * boost;
    let hg = lg * boost;
    let hb = lb * boost;
    const hl = luma(hr, hg, hb);
    const sat = 1 + (hdrSat - 1) * colorResponse * (1 - HDR_COLOR_BASE_STRENGTH);
    hr = Math.max(0, hl + (hr - hl) * sat);
    hg = Math.max(0, hl + (hg - hl) * sat);
    hb = Math.max(0, hl + (hb - hl) * sat);
    hr *= hdrBrightness;
    hg *= hdrBrightness;
    hb *= hdrBrightness;

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

function percentile(sorted, amount) {
  if (!sorted.length) return 0;
  const index = clamp(amount, 0, 1) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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
    state.settings = { ...neutralSettings, ...session.settings };
    renderPresetOptions(session.preset || "custom");
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

function setStatus() {
}

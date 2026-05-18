const HDR_COLOR_BASE_STRENGTH = 0.18;
const HDR_COLOR_RESPONSE_FLOOR = 0.06;
const NEUTRAL_SETTING_EPSILON = 0.000001;

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

self.addEventListener("message", (event) => {
  const { id, mode, width, height, rgbaBuffer, settings } = event.data || {};
  if (!id || !rgbaBuffer || !width || !height) return;

  try {
    const rgba = new Uint8ClampedArray(rgbaBuffer);
    const safeSettings = { ...neutralSettings, ...(settings || {}), hdrSaturation: neutralSettings.hdrSaturation };
    if (mode === "ultra") {
      const hdrBuffer = new Float32Array(width * height * 3);
      fillSdrAndHdrBuffers(rgba, hdrBuffer, safeSettings);
      self.postMessage({ id, width, height, rgbaBuffer, hdrBuffer: hdrBuffer.buffer }, [rgbaBuffer, hdrBuffer.buffer]);
      return;
    }

    processPixels(rgba, safeSettings, mode === "gain" ? "gain" : mode === "hdr" ? "hdr" : "sdr");
    self.postMessage({ id, width, height, rgbaBuffer }, [rgbaBuffer]);
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : "Pixel worker processing failed.",
    });
  }
});

function getEffectiveHdrSaturation() {
  return neutralSettings.hdrSaturation;
}

function getEffectiveHdrBrightness(settings = neutralSettings) {
  const raw = Math.max(1, settings.hdrBrightness ?? neutralSettings.hdrBrightness);
  return 1 + (raw - 1) * 1.75;
}

function getGainResponse(linearLuma, settings) {
  const threshold = srgbToLinear(clamp01(settings.highlightThreshold));
  const softness = 0.012 + (settings.highlightSoftness ** 1.35) * (1 - threshold) * 0.85;
  const mask = smoothstep(threshold, threshold + softness, linearLuma);
  const power = Math.max(0.1, settings.highlightPower);
  const gamma = Math.max(0.1, settings.gainmapGamma);
  return Math.pow(clamp01(mask), power * gamma);
}

function fillSdrAndHdrBuffers(data, hdrBuffer, settings) {
  const exposure = 2 ** settings.sdrExposure;
  const contrast = settings.sdrContrast;
  const shadows = settings.sdrShadows ?? 0;
  const highlights = settings.sdrHighlights ?? 0;
  const sdrSat = settings.sdrSaturation;
  const headroom = settings.hdrHeadroom;
  const hdrBrightness = getEffectiveHdrBrightness(settings);
  const hdrSat = getEffectiveHdrSaturation(settings);

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
    const gainResponse = getGainResponse(ll, settings);
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

function processPixels(data, settings, mode) {
  const exposure = 2 ** settings.sdrExposure;
  const contrast = settings.sdrContrast;
  const shadows = settings.sdrShadows ?? 0;
  const highlights = settings.sdrHighlights ?? 0;
  const sdrSat = settings.sdrSaturation;
  const headroom = settings.hdrHeadroom;
  const hdrBrightness = getEffectiveHdrBrightness(settings);
  const hdrSat = getEffectiveHdrSaturation(settings);

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
    const gainResponse = getGainResponse(ll, settings);
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
      data[i] = Math.round(linearToSrgb(toneMapPreview(hr)) * 255);
      data[i + 1] = Math.round(linearToSrgb(toneMapPreview(hg)) * 255);
      data[i + 2] = Math.round(linearToSrgb(toneMapPreview(hb)) * 255);
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

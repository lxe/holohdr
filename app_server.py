#!/usr/bin/env python3
import argparse
import base64
import importlib.util
import json
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.parse import urlparse

import numpy as np
from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parent
COMFY_ROOT = ROOT.parent
LXE_EXPORT_PATH = COMFY_ROOT / "custom_nodes" / "ComfyUI_LXENodes" / "ultra_hdr_export.py"
sys.path.insert(0, str(COMFY_ROOT))


def load_lxe_export_module():
    spec = importlib.util.spec_from_file_location("lxe_ultra_hdr_export", LXE_EXPORT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {LXE_EXPORT_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


lxe = load_lxe_export_module()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        if urlparse(self.path).path != "/api/export-ultrahdr":
            self.send_error(404)
            return

        try:
            payload = self._read_json()
            image = decode_data_url(payload["image"])
            settings = payload.get("settings", {})
            max_side = parse_export_size(payload.get("exportSize", "full"))
            filename = safe_filename(payload.get("filename") or "image")

            if max_side is not None:
                image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)

            result = render_ultra_hdr(image, settings)
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Content-Length", str(len(result)))
            self.send_header(
                "Content-Disposition",
                f'attachment; filename="{filename}-ultrahdr.jpg"',
            )
            self.end_headers()
            self.wfile.write(result)
        except Exception as exc:
            message = json.dumps({"error": str(exc)}).encode("utf-8")
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(message)))
            self.end_headers()
            self.wfile.write(message)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            raise ValueError("Empty request body")
        return json.loads(self.rfile.read(length).decode("utf-8"))


def render_ultra_hdr(image, settings):
    from hdrconv.convert.gainmap import hdr_to_gainmap
    from hdrconv.core import HDRImage
    from hdrconv.io.iso21496 import write_21496
    from hdrconv.io.ultrahdr import write_ultrahdr

    image = ImageOps.exif_transpose(image).convert("RGB")
    encoded = np.asarray(image, dtype=np.float32) / 255.0
    icc = lxe._load_icc_profile("sRGB", "")

    sdr_encoded = lxe._adjust_sdr(
        encoded,
        float(settings.get("sdrExposure", 0.0)),
        float(settings.get("sdrContrast", 1.0)),
        float(settings.get("sdrSaturation", 1.0)),
    )
    baseline_linear = lxe._srgb_to_linear(sdr_encoded)
    hdr_linear, _mask = lxe._make_hdr_linear(
        baseline_linear,
        hdr_headroom=float(settings.get("hdrHeadroom", 3.0)),
        threshold=float(settings.get("highlightThreshold", 0.55)),
        softness=float(settings.get("highlightSoftness", 0.35)),
        power=float(settings.get("highlightPower", 1.25)),
        saturation=float(settings.get("hdrSaturation", 1.08)),
    )

    gainmap_data = hdr_to_gainmap(
        HDRImage(
            data=hdr_linear.astype(np.float32),
            transfer_function="linear",
            icc_profile=icc,
        ),
        baseline=baseline_linear.astype(np.float32),
        icc_profile=icc,
        gamma=float(settings.get("gainmapGamma", 1.0)),
    )
    gainmap_data["baseline_icc"] = icc
    gainmap_data["gainmap_icc"] = icc
    gainmap_data = lxe._set_gainmap_channels(gainmap_data, "rgb")
    gainmap_data["gainmap"] = lxe._resize_gainmap(gainmap_data["gainmap"], "full")

    with NamedTemporaryFile(suffix=".jpg", delete=False) as temp:
        temp_path = temp.name
    try:
        saved_paths = lxe._write_gainmap_files(
            gainmap_data,
            temp_path,
            "ultrahdr_plus_iso",
            write_ultrahdr=write_ultrahdr,
            write_21496=write_21496,
            baseline_quality=97,
            gainmap_quality=95,
        )
        with open(saved_paths[0], "rb") as file:
            return file.read()
    finally:
        for path in {temp_path, *locals().get("saved_paths", [])}:
            try:
                os.unlink(path)
            except FileNotFoundError:
                pass


def decode_data_url(value):
    if "," in value:
        value = value.split(",", 1)[1]
    return Image.open(BytesIO(base64.b64decode(value)))


def parse_export_size(value):
    if value in ("full", None):
        return None
    if value == "preview":
        return 1800
    return int(value)


def safe_filename(value):
    cleaned = "".join(ch for ch in value if ch.isalnum() or ch in ("-", "_", "."))
    return cleaned[:80] or "image"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=5177)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Serving HDR Gain Map Tuner on http://{args.host}:{args.port}/")
    server.serve_forever()


if __name__ == "__main__":
    main()

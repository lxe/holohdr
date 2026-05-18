SHELL := /bin/bash

WASM_SOURCE := third_party/lib-open-ultrahdr
WASM_BUILD := .build/lib-open-ultrahdr
WASM_PATCH := vendor/open-ultrahdr/patches/0001-preserve-sdr-intent.patch
WASM_VENDOR := vendor/open-ultrahdr
SITE_DIR := .build/site
SITE_FILES := index.html styles.css app.js manifest.webmanifest ultrahdr-worker.js pixel-worker.js assets vendor/open-ultrahdr/open_ultrahdr.js vendor/open-ultrahdr/open_ultrahdr.wasm
DEV_HOST ?= 127.0.0.1
DEV_PORT ?= 8000

.PHONY: all submodules wasm verify site publish serve clean

all: wasm verify

submodules:
	git submodule update --init --recursive $(WASM_SOURCE)

wasm: submodules
	rm -rf $(WASM_BUILD)
	mkdir -p $(dir $(WASM_BUILD))
	rsync -a --delete --exclude .git $(WASM_SOURCE)/ $(WASM_BUILD)/
	patch -d $(WASM_BUILD) -p1 < $(WASM_PATCH)
	cd $(WASM_BUILD)/wasm && npm run build
	cp $(WASM_BUILD)/wasm/pkg/open_ultrahdr.js $(WASM_VENDOR)/open_ultrahdr.js
	cp $(WASM_BUILD)/wasm/pkg/open_ultrahdr.wasm $(WASM_VENDOR)/open_ultrahdr.wasm

verify:
	node --check app.js
	node --check ultrahdr-worker.js
	node --check pixel-worker.js
	python3 -m json.tool manifest.webmanifest >/dev/null

site: verify
	rm -rf $(SITE_DIR)
	mkdir -p $(SITE_DIR)
	rsync -a --relative $(SITE_FILES) $(SITE_DIR)/

publish: site
	@test -n "$(DEPLOY_TARGET)" || (echo "Usage: make publish DEPLOY_TARGET=user@host:/absolute/site/path/" >&2; exit 2)
	rsync -az --delete $(SITE_DIR)/ $(DEPLOY_TARGET)

serve:
	python3 app_server.py --host $(DEV_HOST) --port $(DEV_PORT)

clean:
	rm -rf .build

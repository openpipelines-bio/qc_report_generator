# Project instructions for GitHub Copilot

## Architectural constraints
- Deliver a **single self-contained HTML report**. Render the UI shell immediately; load and hydrate heavy data later.
- Data must be embedded as a **compressed binary blob** (base64) in a non-executed tag, e.g. `<script id="payload" type="application/octet-stream">…</script>`.
- **Decompress in a Web Worker** using the **Compression Streams API** (`new DecompressionStream('gzip')`) or a zstd WASM decoder if needed. Never block the main thread.
- Keep data **columnar** and **typed** (`Float32Array`, `Int32Array`, etc.). Avoid arrays-of-objects.
- SolidJS: wrap expensive widgets in **`<Suspense>`** with fallbacks; data loads progressively; lazy-load chart code.
- For large scatter/spatial: use **precomputed multi-scale hex/tiles**. Never render millions of raw points.

## Code quality & perf
- No AoO unless a chart library absolutely requires it; then adapt locally without duplicating the whole dataset.
- Transfer **ArrayBuffers** between worker and main to avoid copies.
- Add a small **packer script** (Node or R) that outputs the binary + header describing columns.
- Add basic **Playwright** smoke tests: shell paints instantly; charts appear after hydration; no main-thread jank during decompression.

## Definitions of done
- First paint shows navigation + controls within ~1 second on a mid‑range laptop with a 30–80 MB compressed payload.
- No more than one copy of the dataset in memory at once.
- CI runs packer + unit tests; Playwright checks first paint and chart hydration.


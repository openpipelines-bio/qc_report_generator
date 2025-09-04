# incubator-ingestion-qc

This is a project to visualize the ingestion qc data. Currently, 2 types of data are supported:

- Single-cell (CellRanger ingestion)
- Xenium

## Usage

Install dependencies:

```bash
pnpm install
```

Generate test data:
```bash
# Small dataset (20 cells, ~4KB)
Rscript scripts/generate_data.R sc resources_test/sc_dataset

# Large dataset (1.2M cells, ~68MB) 
Rscript scripts/generate_data.R sc_large resources_test/sc_dataset_large

# Xenium dataset
Rscript scripts/generate_data.R xenium resources_test/xenium_dataset
```

### Generate Single-Cell Report

Compress single-cell input data:

```bash
pnpm run compress_data resources_test/sc_dataset/structure.json src/data/report_structure.ts

pnpm run compress_data resources_test/sc_dataset/data.json src/data/dataset.ts
```

Generate single-cell report:
```bash
pnpm run build
```

The report should now have been built at `dist/index.html`

### Generate Xenium Report

Compress Xenium input data:

```bash
pnpm run compress_data resources_test/xenium_dataset/structure.json src/data/report_structure.ts

pnpm run compress_data resources_test/xenium_dataset/data.json src/data/dataset.ts
```

Generate Xenium report:
```bash
pnpm run build
```

The report should now have been built at `dist/index.html`

## Available Scripts

In the project directory, you can run:

### `pnpm install`

Run this command to install the dependencies of the project.

### `pnpm run compress_data`

Enhanced data compression script that supports both legacy and new formats:

**Legacy TypeScript modules (backward compatibility):**
```bash
pnpm run compress_data data.json src/data/dataset.ts
```

**New columnar binary format (for progressive loading):**
```bash
pnpm run compress_data data.json payload.txt structure.json
```

The script automatically detects the output format based on file extensions and arguments.

### `pnpm run test-format`

Tests the new columnar binary format and compares compression ratios:
```bash
pnpm run test-format [payload.txt] [data.json] [structure.json]
```

### `pnpm run dev`

Runs the app in the development mode.<br>
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br>

### `pnpm run build`

Builds the app for production to the `dist` folder.<br>
It correctly bundles Solid in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br>
Your app is ready to be deployed!

### `pnpm run prettier`

Runs prettier on the project.

## Documentation

* State management: [Solid Core](https://docs.solidjs.com/)

* Styling: [Tailwind CSS](https://tailwindcss.com/docs)

* Component library: [Solid UI](https://www.solid-ui.com/docs/components/accordion)

# SnapFold

SnapFold is a browser-only React/Vite prototype for turning an orbital photo set into a printable papercraft-style unfolding template. It is designed for static hosting on GitHub Pages and performs photo handling, HEIC preview conversion, geometric net generation, and PDF export entirely in the browser.

## What the prototype does

1. Explains how to capture 20–50 overlapping low-, mid-, and high-angle photographs.
2. Accepts JPG, PNG, HEIC, and HEIF files using local browser file APIs.
3. Derives a manageable faceted prism proxy from the photo count.
4. Displays the proxy mesh in Three.js / React Three Fiber.
5. Unfolds the proxy into a planar net.
6. Classifies cut, mountain-fold, valley-fold, and glue-tab geometry.
7. Fits the geometry to US Letter paper with 0.25-inch margins and a user-controlled scale from 10% to 100% of maximum printable fit.
8. Exports a single-sided vector PDF with a project header and engineering legend.

## Important prototype boundary

SnapFold does **not** perform photogrammetry or reconstruct arbitrary 3D geometry from image pixels. The current static frontend uses the number of input views to parameterize an algorithmic prism-like proxy. The unfolding and page-layout code is real geometry and is structured so a future mesh-reconstruction stage can replace the proxy generator.

## Stack

- React + Vite
- Tailwind CSS
- Three.js via `@react-three/fiber` and `@react-three/drei`
- `heic2any` for browser-side HEIC/HEIF preview conversion
- `jsPDF` for vector Letter-size PDF generation

## Local development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## GitHub Pages deployment

The repository includes `.github/workflows/deploy.yml`.

On every push to `main`, the workflow:

1. checks out the repository;
2. installs Node.js 24;
3. installs dependencies with `npm install --no-audit --no-fund`;
4. runs `npm run build`;
5. publishes `dist/` to the `gh-pages` branch.

`vite.config.js` derives the GitHub repository name from the `GITHUB_REPOSITORY` environment variable, so the production `base` becomes `/<repository-name>/` automatically. Local development continues to use `/`.

### One-time GitHub Pages setting

After the workflow creates the `gh-pages` branch for the first time:

1. Open **Repository → Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch **gh-pages** and folder **/(root)**.
4. Save.

The workflow requires `contents: write`, which is declared in `deploy.yml`. If repository policy blocks that permission, enable write access for Actions under **Settings → Actions → General → Workflow permissions**.

## Geometry conventions

- **Solid black**: outer cut line
- **Dashed red**: mountain fold
- **Dotted blue**: valley fold
- **Shaded green + dashed border**: glue tab

The tab generator creates outward trapezoids with approximately 45-degree side tethers. Candidate tabs are collision-tested against non-parent faces and already accepted tabs. A colliding candidate is progressively reduced before being rejected.

## Letter-page model

The page model uses physical inch units:

- Paper: 8.5 × 11 in
- Margin: 0.25 in
- Header band: 0.38 in
- Legend band: 0.42 in
- Figure scale: 10–100% of the largest non-overflowing fit

The same transform is used by both the preview renderer and the PDF exporter.

## Project structure

```text
SnapFold/
├── .github/workflows/deploy.yml
├── src/
│   ├── components/
│   │   ├── AdhesiveStep.jsx
│   │   ├── ExportHub.jsx
│   │   ├── FlatteningStep.jsx
│   │   ├── Instructions.jsx
│   │   ├── ModelViewport.jsx
│   │   ├── NetCanvas.jsx
│   │   ├── Simulation.jsx
│   │   ├── Stepper.jsx
│   │   └── UploadPanel.jsx
│   ├── utils/
│   │   ├── imageFiles.js
│   │   ├── pdfExporter.js
│   │   └── unfolder.js
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── eslint.config.js
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
└── vite.config.js
```

## Next engineering step

Replace `createPrismNet()` with an adapter that consumes a real indexed mesh (`vertices`, `faces`, and adjacency). The page-fit, cut/fold rendering, tab generation, collision logic, and PDF export can then remain largely unchanged.

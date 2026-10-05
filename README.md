# SnapFold

[![Deploy SnapFold to GitHub Pages](https://github.com/ErChulo/snapfold/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/ErChulo/snapfold/actions/workflows/deploy.yml)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-brightgreen)](https://erchulo.github.io/snapfold/)
![Version](https://img.shields.io/badge/version-v0.1.1-blue)
![Browser only](https://img.shields.io/badge/processing-browser--only-6f42c1)

**Live app:** https://erchulo.github.io/snapfold/

SnapFold is a browser-only React/Vite prototype for turning an orbital photo set into a printable papercraft-style unfolding template. It is designed for static hosting on GitHub Pages and performs photo handling, HEIC preview conversion, geometric net generation, and PDF export entirely in the browser.

## Capture protocol

For a normal object, use **three complete 360° rings** around a stationary object. Aim the camera near the object's center throughout the capture.

| Pass | Camera elevation | Suggested photos | What to do |
| --- | ---: | ---: | --- |
| Low ring | 15–25° | 8–12 | Walk one complete circle around the object. |
| Middle ring | 35–50° | 12–18 | Walk one complete circle; make this the densest ring. |
| High ring | 60–75° | 8–12 | Walk one complete circle to cover upper surfaces. |
| Top | near top-down | 1–4 | Add only when the high ring does not adequately show the top. |

Practical rules:

- **Overlap:** target 60–80% overlap between neighboring images.
- **Distance:** keep roughly the same camera-to-object radius so the object remains about the same size in the frame. Exact distance need not be mathematically constant.
- **Zoom/focal length:** keep it fixed. Do not zoom between photographs.
- **Object:** do not move or rotate it during the main capture.
- **Camera aim:** keep the object near the center of the image.
- **Lighting/exposure:** keep them as stable as practical; avoid strong moving reflections or shadows.
- **Background:** some visual texture helps feature matching; a blank glossy background is less useful.
- **Bottom/underside:** optional. If the underside matters, photograph it as a separate capture set that can later be registered to the main reconstruction.

Geometrically, the preferred camera locations approximate three latitude rings on a sphere or ellipsoid around the object, rather than a single horizontal cylinder.

## What the prototype does

1. Gives a concise three-ring orbital capture recipe.
2. Accepts JPG, PNG, HEIC, and HEIF files using local browser file APIs.
3. Derives a manageable faceted prism proxy from the photo count.
4. Displays the proxy mesh in Three.js / React Three Fiber.
5. Unfolds the proxy into a planar net.
6. Classifies cut, mountain-fold, valley-fold, and glue-tab geometry.
7. Fits the geometry to US Letter paper with 0.25-inch margins and a user-controlled scale from 10% to 100% of maximum printable fit.
8. Exports a single-sided vector PDF with a project header and engineering legend.

## Important prototype boundary

SnapFold v0.1.x does **not** yet perform photogrammetry or reconstruct arbitrary 3D geometry from image pixels. The current static frontend uses the number of input views to parameterize an algorithmic prism-like proxy.

The intended development path is:

```text
orbital photos
→ feature matching
→ camera-pose estimation
→ 3D reconstruction
→ smooth/curvature-aware surface model
→ developable panelization and strategic seams
→ glue tabs
→ printable PDF
→ photographic color/texture projection
```

The long-term goal is **not** a visibly low-poly model. Polygon meshes may remain an internal numerical representation, while the printable model can use curvature-aware seam placement, smooth bends, and curved panel boundaries where the paper geometry permits them.

## Stack

- React + Vite
- Tailwind CSS
- Three.js via `@react-three/fiber` and `@react-three/drei`
- `heic2any` for browser-side HEIC/HEIF preview conversion
- `jsPDF` for vector Letter-size PDF generation
- GitHub Actions + GitHub Pages for automatic static deployment

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

GitHub Pages is configured to publish from `gh-pages` at `/(root)`. The workflow declares `contents: write`, which is required to update the deployment branch.

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

## Verified v0.1.x smoke test

The live application has been manually exercised through:

```text
photo selection
→ local thumbnail preview
→ 3D viewport
→ 2D Letter preview
→ flattening metrics
→ adhesive-tab stage
→ PDF export
```

The generated PDF was confirmed to download and open successfully.

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

Replace `createPrismNet()` with a real browser-side reconstruction adapter. Preserve the working page-fit, engineering-line rendering, glue-tab generation, collision logic, PDF export, and static GitHub Pages deployment while progressively replacing the synthetic proxy with photo-derived geometry.

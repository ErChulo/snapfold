# SnapFold

<p align="center"><img src="public/brand/snapfold-logo.svg" alt="SnapFold" width="620"></p>

[![Deploy SnapFold to GitHub Pages](https://github.com/ErChulo/snapfold/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/ErChulo/snapfold/actions/workflows/deploy.yml)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-brightgreen)](https://erchulo.github.io/snapfold/)
![Version](https://img.shields.io/badge/version-v0.2.0--alpha.3-blue)
![Browser only](https://img.shields.io/badge/processing-browser--only-6f42c1)

**Live app:** https://erchulo.github.io/snapfold/

SnapFold is a browser-only React/Vite prototype for turning an orbital photo set into a printable papercraft-style unfolding template. It is designed for static hosting on GitHub Pages. v0.2.0-alpha.3 begins the real reconstruction pipeline: ORB image features are extracted locally with OpenCV/WASM, matches are geometrically filtered with a deterministic calibrated eight-point RANSAC implementation, relative camera poses are recovered from the essential matrix, and inlier tracks are triangulated into a sparse 3D diagnostic cloud. The validated Letter-page/PDF pipeline remains available downstream as a legacy proxy until dense surface reconstruction replaces it.

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

## What v0.2.0-alpha.3 does

1. Gives a concise three-ring orbital capture recipe.
2. Accepts JPG, PNG, HEIC, and HEIF files using local browser file APIs.
3. Reads useful EXIF camera metadata when present and estimates intrinsics when it is absent.
4. Downscales analysis copies locally and extracts ORB keypoints/descriptors through OpenCV/WASM.
5. Discovers an overlap graph between views, applies a Lowe-style descriptor-ratio filter, and estimates calibrated epipolar geometry with deterministic RANSAC. For sets up to 24 images, every pair is tested.
6. Scores verified pairwise edges, selects the strongest connected camera component, then recovers camera rotations/translation directions along a strongest-edge spanning tree using essential-matrix decomposition and cheirality testing.
7. Triangulates accepted correspondences into a sparse 3D point cloud and displays registered camera positions/view directions.
8. Preserves the existing prism-based paper-net, tab, Letter-page, and PDF pipeline as an explicitly labeled legacy downstream proxy.

## Alpha fixes

- **alpha.2:** uses the package-supported OpenCV initialization path and avoids treating the Emscripten module as an arbitrary thenable; this fixes the Firefox runtime error `Promise.prototype.then called on incompatible Object`.
- **alpha.3:** replaces the fragile previous-view registration chain with an overlap graph. For capture sets up to 24 photos, every pair is tested, geometrically verified edges are scored, the largest connected component is selected, and camera poses are initialized along a strongest-edge spanning tree. Upload order and ring transitions no longer determine whether a view can register.

## Important alpha boundary

The **Step 3 sparse cloud is photo-derived**. The paper net shown in Steps 4–7 is **not yet generated from that sparse cloud**. Dense multi-view surface reconstruction, global bundle adjustment, curvature-aware panelization, and material-aware unfolding are subsequent milestones.

Monocular structure-from-motion also has arbitrary global scale. v0.2.0-alpha.3 normalizes pair baselines for diagnostic visualization; it does not claim metric dimensions from photographs alone.

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

## Brand assets

The production UI uses scalable SVG derivatives of the selected impossible-geometry concept:

- `public/brand/snapfold-logo.svg` — horizontal lockup
- `public/brand/snapfold-mark.svg` — standalone impossible S/F mark
- `public/brand/snapfold-wordmark.svg` — wordmark
- `public/brand/snapfold-icon.svg` — rounded app icon
- `public/favicon.svg` — browser favicon

## Stack

- React + Vite
- Tailwind CSS
- Three.js via `@react-three/fiber` and `@react-three/drei`
- OpenCV.js/WASM via `@techstark/opencv-js` for ORB feature extraction and Hamming matching
- `ml-matrix` for browser-side epipolar geometry, pose decomposition, and triangulation
- `exifr` for local EXIF camera metadata
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
├── public/
│   ├── brand/
│   │   ├── snapfold-icon.svg
│   │   ├── snapfold-logo.svg
│   │   ├── snapfold-mark.svg
│   │   └── snapfold-wordmark.svg
│   ├── favicon.svg
│   └── site.webmanifest
├── src/
│   ├── components/
│   │   ├── AdhesiveStep.jsx
│   │   ├── ExportHub.jsx
│   │   ├── FlatteningStep.jsx
│   │   ├── Instructions.jsx
│   │   ├── ModelViewport.jsx
│   │   ├── NetCanvas.jsx
│   │   ├── ReconstructionStep.jsx
│   │   ├── SparseViewport.jsx
│   │   ├── Simulation.jsx
│   │   ├── Stepper.jsx
│   │   └── UploadPanel.jsx
│   ├── utils/
│   │   ├── reconstruction/
│   │   │   ├── linearAlgebra.js
│   │   │   ├── opencv.js
│   │   │   ├── photoAnalysis.js
│   │   │   └── sparseReconstruction.js
│   │   ├── imageFiles.js
│   │   ├── materialProfile.js
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

## Material-aware architecture

The project now carries a material-profile contract even though alpha.1 does not yet apply it to unfolding:

```text
mode
thicknessMm
minBendRadiusMm
kerfMm
grainDirection
```

This is reserved for direct-print paper as well as overlay/template workflows for cardstock, chipboard, and bendable cardboard.

## Next engineering step

Validate alpha.3 against the same real orbital photo set. Then add multi-view track chaining and global bundle adjustment before proceeding to dense surface reconstruction. Once a stable dense surface exists, replace the legacy prism with curvature-aware, material-aware panelization and unfolding.

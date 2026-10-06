# SnapFold

<p align="center"><img src="public/brand/snapfold-logo.svg" alt="SnapFold" width="620"></p>

[![Deploy SnapFold to GitHub Pages](https://github.com/ErChulo/snapfold/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/ErChulo/snapfold/actions/workflows/deploy.yml)
[![Build SnapFold Desktop](https://github.com/ErChulo/snapfold/actions/workflows/desktop.yml/badge.svg?branch=main)](https://github.com/ErChulo/snapfold/actions/workflows/desktop.yml)
![Version](https://img.shields.io/badge/version-v0.3.0--alpha.1-blue)

SnapFold turns overlapping photographs into a 3D reconstruction and is being developed toward curvature-aware printable paper/cardboard models.

## v0.3.0-alpha.1: native reconstruction

The desktop application is now a Tauri/React application with a bundled **COLMAP 4.2 CPU runtime**. The native path is separate from the earlier browser SfM experiment.

Desktop reconstruction:

```text
choose local photos
→ COLMAP SIFT feature extraction
→ exhaustive feature matching
→ incremental Structure-from-Motion
→ COLMAP triangulation + bundle adjustment
→ colored sparse PLY
→ optional sparse Delaunay PLY mesh
→ Three.js model viewer
```

The selected photographs are copied into a local SnapFold workspace and are not uploaded to SnapFold or to a cloud reconstruction service.

The desktop workflow deliberately stops after the real reconstruction viewer. It does **not** feed a synthetic prism into the PDF pipeline.

### Linux desktop download

GitHub Actions builds an AppImage and Debian package and publishes them to the prerelease named:

```text
SnapFold Desktop v0.3.0-alpha.1
```

The AppImage contains the COLMAP CPU runtime used by SnapFold, so the user does not need to install COLMAP separately.

## Capture protocol

Use overlapping photographs of a stationary object:

| Pass | Camera elevation | Suggested photos |
| --- | ---: | ---: |
| Low ring | 15–25° | 8–12 |
| Middle ring | 35–50° | 12–18 |
| High ring | 60–75° | 8–12 |
| Top | near top-down | 1–4 |

Target roughly 60–80% overlap, keep focal length fixed, keep the object stationary, and avoid changing zoom.

## Web application

The GitHub Pages application remains available at:

https://erchulo.github.io/snapfold/

The web reconstruction code is retained as an experimental diagnostic. The serious reconstruction path is the native desktop COLMAP path.

## Desktop architecture

```text
React / Vite
    ↓ Tauri invoke + progress events
Rust / Tauri
    ↓ local process
Bundled COLMAP 4.2 CPU
    ↓
PLY point cloud / optional PLY mesh
    ↓
Three.js viewer
```

Rust is responsible for local workspace creation, copying selected images, invoking COLMAP, reporting progress, selecting the strongest sparse model, exporting PLY, and returning the geometry to React.

## Material-aware target

SnapFold already carries a material profile for the later unfolding stage:

```text
mode
thicknessMm
minBendRadiusMm
kerfMm
grainDirection
```

The intended downstream pipeline remains:

```text
real reconstructed surface
→ mesh cleanup
→ curvature analysis
→ developable panelization
→ thickness / bend / kerf compensation
→ paper or cardboard templates
→ tabs
→ PDF
```

## Development

Web:

```bash
npm install
npm run dev
```

Desktop development requires a COLMAP runtime under:

```text
src-tauri/resources/colmap-env/
```

The CI workflow creates this environment from conda-forge automatically before running:

```bash
npm run tauri build -- --bundles appimage,deb
```

## Key source layout

```text
src/
├── components/
│   ├── DesktopUploadPanel.jsx
│   ├── DesktopReconstructionStep.jsx
│   ├── DesktopModelViewport.jsx
│   └── ...
├── utils/
│   ├── desktop.js
│   ├── reconstruction/
│   └── ...
└── App.jsx

src-tauri/
├── Cargo.toml
├── build.rs
├── tauri.conf.json
├── capabilities/default.json
├── resources/colmap-env/
└── src/
    ├── lib.rs
    └── main.rs
```

## Existing legacy papercraft pipeline

The v0.1.x prism net, tabs, Letter layout, and vector PDF generator remain in the repository as regression/reference code. They are not presented as reconstruction output.

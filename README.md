# SnapFold

<p align="center"><img src="public/brand/snapfold-logo.svg" alt="SnapFold" width="620"></p>

[![Deploy SnapFold to GitHub Pages](https://github.com/ErChulo/snapfold/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/ErChulo/snapfold/actions/workflows/deploy.yml)
[![Build SnapFold Desktop](https://github.com/ErChulo/snapfold/actions/workflows/desktop.yml/badge.svg?branch=main)](https://github.com/ErChulo/snapfold/actions/workflows/desktop.yml)
![Version](https://img.shields.io/badge/version-v0.3.0--alpha.4-blue)

SnapFold turns overlapping photographs into a 3D reconstruction and is being developed toward curvature-aware printable paper/cardboard models.

## v0.3.0-alpha.4: dense CPU reconstruction for Intel graphics

The field machine reports Intel Tiger Lake-LP GT2 / UHD Graphics G4 and therefore has no NVIDIA CUDA device. SnapFold now uses COLMAP for the sparse camera solution and **OpenMVS 2.4.0 CPU PatchMatch** for dense reconstruction and surface meshing.

```text
choose local photos
→ COLMAP CPU SIFT
→ exhaustive geometric matching
→ incremental SfM + bundle adjustment
→ COLMAP image undistortion
→ OpenMVS import
→ OpenMVS CPU PatchMatch depth maps + dense fusion
→ OpenMVS surface reconstruction
→ Three.js dense mesh viewer
```

The desktop package bundles the official OpenMVS 2.4.0 Ubuntu x64 release and verifies its SHA-256 before packaging. OpenMVS uses its native CPU PatchMatch estimator when no CUDA device is available. The dense stage uses conservative resolution/thread settings for lower-memory laptops.

SnapFold reports success only after both a non-empty dense PLY and a mesh containing faces have been produced.

### Linux Mint 22.x / Ubuntu 24.04

Install the Debian package with:

```bash
sudo apt install ./SnapFold_0.3.0-alpha.4_amd64.deb
```

COLMAP remains an APT dependency. OpenMVS is bundled with SnapFold, so no separate OpenMVS installation is required.

The selected photographs remain local in the SnapFold reconstruction workspace.

## Capture protocol

Use overlapping photographs of a stationary object. Target roughly 60–80% overlap, keep focal length fixed, keep the object stationary, and avoid changing zoom.

## Web application

The GitHub Pages build remains available as an experimental browser diagnostic. The production reconstruction path is the desktop application.

## Desktop architecture

```text
React / Vite
    ↓ Tauri invoke + progress events
Rust / Tauri
    ↓
COLMAP 3.9.1 CPU
    ↓ calibrated sparse scene
OpenMVS 2.4.0 CPU PatchMatch
    ↓ dense point cloud + mesh
Three.js viewer
```

## Existing legacy papercraft pipeline

The v0.1.x prism net, tabs, Letter layout, and vector PDF generator remain in the repository as regression/reference code. They are not presented as reconstruction output.

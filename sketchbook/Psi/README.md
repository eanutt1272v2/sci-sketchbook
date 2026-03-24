# Psi

## Overview

A fast numerical visualiser of hydrogenic bound-state probability densities. It computes `|psi_{n,l,m}(r,theta,phi)|^2` using SI-consistent units, reduced-mass Bohr radius scaling, stable log-gamma normalization for radial functions, and complex spherical harmonics.

## Method

For selected quantum numbers `(n, l, m)`, the scalar field is evaluated as

`|psi_{n,l,m}(r,theta,phi)|^2 = |R_{n,l}(r) * Y_l^m(theta,phi)|^2`

where `R_{n,l}` is the normalised radial basis term and `Y_l^m` is the normalised complex spherical harmonic. The computed 3D density is then sampled into 2D slice planes for interactive inspection.

## Architecture

- `AppCore.js`: state, render queue, and worker management
- `PsiWorker.js`: density-grid computation kernel
- `Renderer.js`: LUT rendering, overlays, and legend
- `Analyser.js`: worker-statistics adapter and series export/import
- `GUI.js`, `InputHandler.js`, `Media.js`: controls, interaction, and output

## Controls

- Set `n`, `l`, `m`
- Switch slicing plane (`xy`, `xz`, `yz`)
- Pan and zoom the sampled field
- Adjust exposure/resolution
- Toggle overlays, legend, and smoothing

## Notes

- Worker-based computation keeps the interface responsive at higher resolutions.
- LUT and overlay caches aid in mitigating unnecessary rerendering.
- The keymap overlay (`#`) provides the full, up-to-date keyboard binding reference.

## Run

```bash
cd sketchbook/Psi
python3 -m http.server 8080
```

Open `http://localhost:8080`.

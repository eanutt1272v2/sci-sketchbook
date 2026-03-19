# Eigen

## Overview

A fast numerical visualiser of the time-independent Schroedinger equation for a single-electron system. It computes the probability density `|psi_{n,l,m}(r,theta,phi)|^2` of the hydrogen atom by evaluating the product of radial wavefunctions (utilising generalised Laguerre polynomials) and angular components (real spherical harmonics derived from associated Legendre polynomials).

## Method

For selected quantum numbers `(n, l, m)`, the scalar field is evaluated as

`|psi_{n,l,m}(r,theta,phi)|^2 = |R_{n,l}(r) * Y_l^m(theta,phi)|^2`

where `R_{n,l}` is the radial basis term and `Y_l^m` is the angular harmonic term. The computed 3D density is then sampled into 2D slice planes for interactive inspection.

## Architecture

- `AppCore.js`: state, render queue, and worker management
- `EigenWorker.js`: density-grid computation kernel
- `FallbackSolver.js`: synchronous compute fallback
- `Renderer.js`: LUT rendering, overlays, and legend
- `Analyser.js`: advanced field statistics
- `GUI.js`, `InputHandler.js`, `Media.js`: controls, interaction, and output

## Controls

- Set `n`, `l`, `m`
- Switch slicing plane (`xy`, `xz`, `yz`)
- Pan and zoom the sampled field
- Adjust exposure/resolution
- Toggle overlays, legend, and smoothing

## Notes

- Worker-based computation keeps the interface responsive at higher resolutions.
- LUT and overlay caches aid in mitigating unnecessary redrawing.

## Run

```bash
cd sketchbook/Eigen
python3 -m http.server 8080
```

Open `http://localhost:8080`.

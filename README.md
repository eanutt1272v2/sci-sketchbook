# sci-sketchbook <img src="logo.png" alt="sci-sketchbook logo" align="right" width="175">

A specialised and niche repository of interactive scientific simulations constructed using JavaScript. We couple p5.js graphical rendering with the Tweakpane library's parameterised GUI to offer a scientific environment for the exploration of mathematical and physical phenomena. In addition, they each run a dedicated Web Worker for compute-heavy processes.

* p5.js 2.2.3
* Tweakpane 4.x (GUI framework)
* Web Workers (parallel computation)
* WebGL / GLSL (3D rendering pipeline)

Live instances: <https://sci-sketchbook.onrender.com/> (will wind down) | <https://sci-sketchbook.up.railway.app> (always up).

---

## Project Files

* [Cellular Division — Primordial Particle System](./library/Cellular_Division)
* [Psi — Hydrogen Orbital Probability Densities](./library/Psi)
* [Fluvia — Lagrangian Hydraulic Erosion](./library/Fluvia)
* [Lenia ND Studio — Continuous Cellular Automata](./library/Lenia_ND_Studio)

---

## Content

### Sketches

* [Sketch Index](#1-sketch-index)
* [Shared Infrastructure](#2-shared-infrastructure)

### Deployment

* [Running Locally](#3-running-locally)
* [Podman Deployment](#31-podman--caddy-recommended)
* [Static Server](#32-single-sketch-via-static-server)
* [Licence](#licence)

---

### 1. Sketch Index

Every sketch is a self-contained browser-based application with its own solver(s), rendering pipeline, and GUI. All sketches share a unified architecture such that a main-thread controller orchestrates a Web Worker that performs the computationally intensive operations, which keeps the UI responsive at 60–75 FPS.

| Sketch | Domain | Method | Implementation |
| :-- | :-- | :-- | :-- |
| [Cellular Division](./library/Cellular_Division) | Artificial life | Primordial Particle System (PPS) Model — density-driven self-organisation of identical particles into dividing 'cellular' structures | p5.js + Web Worker |
| [Psi](./library/Psi) | Quantum mechanics | Hydrogenic bound-state wavefunctions — normalised radial functions, complex spherical harmonics, and probability density evaluation on slice planes | p5.js + Web Worker |
| [Fluvia](./library/Fluvia) | Geomorphology | Lagrangian particle-based hydraulic erosion modrl with momentum-coupled meandering, thermal erosion, and a basic dual-layer bedrock–sediment data structure | p5.js + Web Worker + GLSL |
| [Lenia ND Studio](./library/Lenia_ND_Studio) | Continuous cellular automata | FFT-accelerated Lenia with configurable kernel/growth families, multi-shell convolution, and 2D/3D/4D support | p5.js + Web Worker |

---

### 2. Shared Infrastructure

All sketches source a subset of methods from a common `_shared/` directory:

| Resource | Path | Purpose |
| :-- | :-- | :-- |
| Colour map LUTs | `_shared/data/colour-maps.json` | 256-entry RGB lookup tables used for scientific visualisation with various colour maps |
| Font | `_shared/fonts/Iosevka-Regular.woff2` | Monospace typeface used for overlays and statistics |
| Shaders | `_shared/shaders/vert.glsl`, `frag.glsl` | Vertex displacement and fragment colouring for 3D terrain in Fluvia |
| Utilities | `_shared/utils/` | Shared run-length codec, transform, and rendering helpers |
| Styles | `_shared/styles/` | Common CSS |

#### 2.1 Worker Data Transfer Pattern

Every sketch follows the following asynchronous process:

1. Main thread initialises the simulation state and spawns a `Worker`.
2. Each frame, the main thread posts a step/render request with `ArrayBuffer` ownership transfer.
3. The worker performs the computation (FFT convolution, particle stepping, density evaluation, erosion solve) and returns the updated buffers.
4. The main thread applies the result to the renderer.

#### 2.2 SimPipe Export Standard

All sketches support a common `simpipe.*` JSON standard for purposes such as parameter, statistics, and world-state import/export:

```json
{
  "format": "simpipe.params | simpipe.stats | simpipe.world",
  "metadata": { "name": "...", "version": "...", "author": "..." },
  "params": { },
  "exportedAt": "ISO 8601"
}
```

---

### 3. Running Locally

#### 3.1 Podman + Caddy (recommended)

```bash
git clone https://github.com/eanutt1272v2/sci-sketchbook.git
cd sci-sketchbook
podman compose up -d --build
```

Open `http://localhost:8080` and navigate to `library/<Sketch_Name>/`.

> [!TIP]
> If your Podman installation does not include the Compose plugin, use `podman-compose up -d --build` instead.

#### 3.2 Single sketch via static server

```bash
cd library/Psi
python3 -m http.server 8080
```

Open `http://localhost:8080`.

> [!NOTE]
> Some sketches using `SharedArrayBuffer` or advanced Worker features require cross-origin isolation headers (`Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`). The Podman + Caddy setup applies these headers automatically, however, a bare static server may not.

---

### Licence

See [`LICENSE`](./LICENSE).

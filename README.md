# sci-sketchbook <img src="logo.png" alt="sci-sketchbook logo" align="right" width="175">

Interactive scientific and mathematical simulations built on p5.js, each running a dedicated Web Worker for compute-heavy kernels.

* p5.js 1.x
* Tweakpane 4.x (GUI framework)
* Web Workers (parallel computation)
* WebGL / GLSL (3D rendering pipeline)

Live instances: <https://sci-sketchbook.onrender.com/> (will wind down) | <https://sci-sketchbook.up.railway.app> (always up).

---

## Project Files

* [Cellular Division — Primordial Particle System](./sketchbook/Cellular_Division)
* [Psi — Hydrogen Orbital Probability Densities](./sketchbook/Psi)
* [Fluvia — Lagrangian Hydraulic Erosion](./sketchbook/Fluvia)
* [Lenia ND Studio — Continuous Cellular Automata](./sketchbook/Lenia_ND_Studio)

---

## Content

### Sketches

* [Sketch Index](#1-sketch-index)
* [Shared Infrastructure](#2-shared-infrastructure)

### Deployment

* [Running Locally](#3-running-locally)
* [Docker Deployment](#31-docker--caddy-recommended)
* [Static Server](#32-single-sketch-via-static-server)
* [Processing Sketches](#33-processing-sketches)
* [Licence](#licence)

---

### 1. Sketch Index

Each sketch is a self-contained browser application with its own simulation kernel, rendering pipeline, and parameter interface. All sketches share a common architecture such that a main-thread controller orchestrates a Web Worker that performs the numerically intensive computation, keeping the UI responsive at 60–75 FPS.

| Sketch | Domain | Method | Implementation |
| :-- | :-- | :-- | :-- |
| [Cellular Division](./sketchbook/Cellular_Division) | Artificial life | Primordial Particle System (PPS): density-driven self-organisation of identical particles into dividing cell-like structures | p5.js + Web Worker |
| [Psi](./sketchbook/Psi) | Quantum mechanics | Hydrogenic bound-state wavefunctions: normalised radial functions, complex spherical harmonics, and probability density evaluation on configurable slice planes | p5.js + Web Worker |
| [Fluvia](./sketchbook/Fluvia) | Geomorphology | Lagrangian particle-based hydraulic erosion with momentum-coupled meandering, thermal diffusion, and dual-layer bedrock–sediment terrain | p5.js + Web Worker + GLSL |
| [Lenia ND Studio](./sketchbook/Lenia_ND_Studio) | Continuous cellular automata | FFT-accelerated Lenia with configurable kernel/growth families, multi-shell convolution, and 2D/3D/4D support | p5.js + Web Worker |

---

### 2. Shared Infrastructure

All sketches draw from a common `_shared/` directory:

| Resource | Path | Purpose |
| :-- | :-- | :-- |
| Colour map LUTs | `_shared/data/colour-maps.json` | 256-entry RGB lookup tables for scientific visualisation |
| Font | `_shared/fonts/Iosevka-Regular.ttf` | Monospace typeface for overlays and statistics |
| Shaders | `_shared/shaders/vert.glsl`, `frag.glsl` | Vertex displacement and fragment colouring for 3D terrain |
| Utilities | `_shared/utils/` | Shared codec, transform, and rendering helpers |
| Styles | `_shared/styles/` | Common CSS |

#### 2.1 Worker Communication Pattern

Every sketch follows the same asynchronous pattern:

1. Main thread initialises the simulation state and spawns a `Worker`.
2. Each frame, the main thread posts a step/render request with `ArrayBuffer` ownership transfer.
3. The worker performs the computation (FFT convolution, particle stepping, density evaluation, erosion solve) and returns updated buffers.
4. The main thread applies the result to the renderer, never blocking on heavy computation.

This design guarantees smooth interaction regardless of simulation cost.

#### 2.2 Export Protocol

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

#### 3.1 Docker + Caddy (recommended)

```bash
git clone https://github.com/eanutt1272v2/sci-sketchbook.git
cd sci-sketchbook
docker compose up -d
```

Open `http://localhost` and navigate to `sketchbook/<Sketch_Name>/`.

The Caddy reverse proxy serves all sketches with correct MIME types and headers for Web Worker and SharedArrayBuffer support.

#### 3.2 Single sketch via static server

```bash
cd sketchbook/Psi
python3 -m http.server 8080
```

Open `http://localhost:8080`.

> [!NOTE]
> Some sketches using `SharedArrayBuffer` or advanced Worker features may require specific HTTP headers (`Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`). The Docker + Caddy setup handles these automatically; a bare static server may not.

#### 3.3 Processing sketches

Open the corresponding `.pde` file in Processing 4.x and run.

---

### Licence

See [`LICENSE`](./LICENSE).

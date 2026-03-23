# sci-sketchbook <img src="logo.png" alt="sci-sketchbook logo" align="right" width="175">

## Overview

An collection of advanced interactive mathematical and scientific sketches implemented in `p5.js`.

Live deployed instance(s): <https://sci-sketchbook.onrender.com/>, <https://sci-sketchbook.up.railway.app>.

## Sketch Index

| Sketch | Summary | Implementation(s) |
| :-- | :-- | :-- |
| [Cellular Division](./sketchbook/Cellular_Division) | Primordial Particle System (PPS) model implementation with custom-built UI framework | p5.js + worker |
| [Psi](./sketchbook/Psi) | Hydrogen orbital probability density slices | p5.js + worker |
| [Fluvia](./sketchbook/Fluvia) | Lagrangian hydraulic erosion simulation | p5.js + worker + GLSL |
| [Lenia 2D Studio](./sketchbook/Lenia_2D_Studio) | Continuous Lenia cellular automata studio | p5.js + FFT worker |

## Running Locally

### Option 1: Docker + Caddy (recommended)

```bash
git clone https://github.com/eanutt1272v2/sci-sketchbook.git
cd sci-sketchbook
docker compose up -d
```

Then open `http://localhost` and navigate to `sketchbook/<Sketch_Name>/`.

### Option 2: Run a single sketch via static server

```bash
cd sketchbook/Mandelbrot_Set
python3 -m http.server 8080
```

Open `http://localhost:8080`.

### Option 3: Processing sketches

Open the corresponding `.pde` file in Processing 4.x and run.

## Licence

See [`LICENSE`](./LICENSE).

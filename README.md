# sci-sketchbook <img src="logo.png" alt="sci-sketchbook logo" align="right" width="175">

## Overview

An collection of advanced interactive mathematical and scientific sketches implemented in `p5.js`.

Live deployed instance(s): <https://sci-sketchbook.onrender.com/> (will wind down), <https://sci-sketchbook.up.railway.app> (always up).

## Sketch Index

| Sketch | Summary | Implementation(s) |
| :-- | :-- | :-- |
| [Cellular Division](./sketchbook/Cellular_Division) | Primordial Particle System (PPS) model implementation with custom-built UI framework | p5.js + worker |
| [Psi](./sketchbook/Psi) | Hydrogen orbital probability density slices | p5.js + worker |
| [Fluvia](./sketchbook/Fluvia) | Lagrangian hydraulic erosion simulation | p5.js + worker + GLSL |
| [Lenia ND Studio](./sketchbook/Lenia_ND_Studio) | Continuous Lenia cellular automata studio | p5.js + worker |

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

## Version Code Management

Sketch version codes are managed from one source of truth:

- `scripts/sketch-versions.json`

Use the sync script to update metadata versions in all sketch entry files:

```bash
node scripts/update-sketch-versions.mjs
```

Validate that tracked versions and in-file metadata are aligned:

```bash
node scripts/update-sketch-versions.mjs --check
```

Update one or more versions and sync in one command:

```bash
node scripts/update-sketch-versions.mjs --set "Psi=v2.7.2-dev" --set "Fluvia=v5.2.1-dev"
```

## Licence

See [`LICENSE`](./LICENSE).

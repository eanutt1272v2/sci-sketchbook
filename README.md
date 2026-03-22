# sci-sketchbook <img src="logo.png" alt="sci-sketchbook logo" align="right" width="175">

## Overview

An advanced collection of interactive mathematical and scientific sketches.

Most active projects are implemented in `p5.js`, but a smaller amount of legacy sketches remain in Processing.

Live deployment: <https://sci-sketchbook.onrender.com/>


## Sketch Index

| Sketch | Summary | Implementation(s) |
| :-- | :-- | :-- |
| [Burning Ship Fractal](./sketchbook/Burning_Ship_Fractal) | Non-holomorphic escape-time fractal | p5.js + worker |
| [Mandelbrot Set](./sketchbook/Mandelbrot_Set) | Quadratic complex-set exploration | p5.js + worker |
| [Julia Set](./sketchbook/Julia_Set) | Parameter-fixed quadratic Julia Set fractal | p5.js + worker |
| [Cellular Division](./sketchbook/Cellular_Division) | Primordial Particle System implementation | p5.js + worker |
| [Psi](./sketchbook/Psi) | Hydrogen orbital probability-density slices | p5.js + worker |
| [Fluvia](./sketchbook/Fluvia) | Lagrangian hydraulic erosion simulation | p5.js + worker + GLSL |
| [Lenia 2D Studio](./sketchbook/Lenia_2D_Studio) | Continuous Lenia cellular automata | p5.js + FFT worker |
| [MandelBulber](./sketchbook/MandelBulber) | Legacy Mandelbulb point-cloud rendering | Processing |
| [Neural Network](./sketchbook/Neural_Network) | Legacy handwritten-digit classifier | Processing |

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

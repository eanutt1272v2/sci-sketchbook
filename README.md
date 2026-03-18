# sci-sketchbook <img src="logo.png" alt="sci-sketchbook logo" align="right" width="175">

A collection of scientific and mathematical creative-coding sketches, simulations, and visualisations.

The repository includes projects built with:
- `p5.js`
- `Processing (Java)`
- `GLSL` shaders (via p5.js/WebGL)

A public deployment is available at `https://sci-sketchbook.onrender.com/`.

## Sketch Index

| Sketch | Summary | Implementations |
| :-- | :-- | :-- |
| [Barnsley Fern](./sketchbook/Barnsley_Fern) | Iterated function system (IFS) fern generated from affine transforms. | Processing (Java), p5.js |
| [Burning Ship Fractal](./sketchbook/Burning_Ship_Fractal) | Burning Ship fractal explorer on the complex plane. | Processing (Java), p5.js |
| [Cellular Division](./sketchbook/Cellular_Division) | Particle-based emergent growth and division simulation. | Processing (Java), p5.js |
| [Collatz Visualisation](./sketchbook/Collatz_Visualisation) | Tree-like rendering of Collatz trajectories. | p5.js |
| [Diffusion Limited Aggregation](./sketchbook/Diffusion_Limited_Aggregation) | Brownian walkers aggregating into branching structures. | p5.js |
| [Eigen](./sketchbook/Eigen) | Matrix, eigenvalue, and eigenvector visualisation tools. | p5.js |
| [Fluvia](./sketchbook/Fluvia) | Fluid and erosion simulation with GLSL acceleration. | p5.js, GLSL |
| [Fluvia Lite](./sketchbook/Fluvia_Lite) | Lightweight, fork-friendly Fluvia variant. | p5.js |
| [GLSL Shader Exploration 01](./sketchbook/GLSL_Shader_Exploration_01) | Experimental procedural shader ported from a shader by Xor. | p5.js, GLSL |
| [Julia Set](./sketchbook/Julia_Set) | Interactive Julia set fractal explorer. | Processing (Java), p5.js |
| [Lenia 2D Studio](./sketchbook/Lenia_2D_Studio) | Continuous cellular automata playground inspired by Lenia. | p5.js |
| [Mandelbrot Set](./sketchbook/Mandelbrot_Set) | Interactive Mandelbrot set fractal explorer. | Processing (Java), p5.js |
| [MandelBulber](./sketchbook/MandelBulber) | 3D Mandelbulb point-cloud exploration in Processing. | Processing (Java) |
| [Mandelbulb GLSL Shader](./sketchbook/Mandelbulb_GLSL_Shader) | Real-time Mandelbulb raymarching with GLSL. | p5.js, GLSL |
| [Neural Network](./sketchbook/Neural_Network) | Visual and functional feedforward digit-recognition neural network demonstration. | Processing (Java) |
| [Slime Mold Growth](./sketchbook/Slime_Mold_Growth) | Agent-based Physarum-style growth simulation. | JavaScript |

## Running Locally

### Option 1: Docker + Caddy (recommended)

1. Clone the repository.

```bash
git clone https://github.com/eanutt1272v2/sci-sketchbook.git
cd sci-sketchbook
```

2. Start the local server.

```bash
docker compose up -d
```

3. Open `http://localhost`.

Notes:
- Default ports are `80` and `443`.
- View logs with `docker compose logs -f`.

### Option 2: Open sketch folders directly

Most browser sketches can also be run from each sketch directory via a simple static web server.

Example:
```bash
cd sketchbook/Mandelbrot_Set/p5_JS
python3 -m http.server 8080
```
Then open `http://localhost:8080`.

Processing sketches can be opened in Processing 4.x via the corresponding `.pde` entry file.

## Licence

This project is made available under the terms in [`LICENSE`](./LICENSE).

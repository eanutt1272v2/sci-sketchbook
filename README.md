# sci-sketchbook <img src="logo.png" alt="sci-sketchbook logo" align="right" width="175">

> [!IMPORTANT]
> **Major Migration and Refactor Notice**
> 
> I am currently transitioning the vast majority of the library's sketches from **Processing (Java)** to **p5.js** to improve web accessibility, cross-device support, and eliminate version/feature drift caused by legacy versions. During this period:
> - Many sketches are undergoing massive structural refactors which I am attempting to complete and roll out quickly.
> - Legacy `.pde` files and sketch versions are being phased out. Some older experiments may be discontinued or deleted if they no longer fit my goals.
> - You may encounter some bugs, but these will likely be patched very quickly. If they are not patched, give me a nudge in issues or email me at [**eanutt1272.v2@gmail.com**](mailto:eanutt1272.v2@gmail.com).

A collection of scientific and mathematical creative-coding sketches, simulations, and visualisations.

The repository includes projects built with:
- `p5.js`
- `Processing (Java)` (soon to be discontinued)
- `GLSL` shaders (via p5.js/WebGL)

A public deployment is available at <https://sci-sketchbook.onrender.com/>.

## Sketch Index

| Sketch | Summary | Implementations |
| :-- | :-- | :-- |
| [Burning Ship Fractal](./sketchbook/Burning_Ship_Fractal) | Burning Ship fractal explorer on the complex plane. | p5.js |
| [Cellular Division](./sketchbook/Cellular_Division) | Particle-based emergent growth and division simulation based on PPS model. | p5.js |
| [Eigen](./sketchbook/Eigen) | Hydrogen orbital visualiser mapping electron probability density using radial and angular wavefunctions. | p5.js |
| [Fluvia](./sketchbook/Fluvia) | Fast Lagrangian hydraulic terrain erosion simulation with meandering river systems. | p5.js, GLSL |
| [Julia Set](./sketchbook/Julia_Set) | Interactive Julia set fractal explorer. | Processing (Java), p5.js |
| [Lenia 2D Studio](./sketchbook/Lenia_2D_Studio) | Lenia continuous cellular automata implementation with catalogue and statistics. | p5.js |
| [Mandelbrot Set](./sketchbook/Mandelbrot_Set) | Interactive Mandelbrot set fractal explorer. | Processing (Java), p5.js |
| [MandelBulber](./sketchbook/MandelBulber) | 3D Mandelbulb point-cloud exploration in Processing. | Processing (Java) |
| [Neural Network](./sketchbook/Neural_Network) | Visual and functional feedforward digit-recognition neural network demonstration. | Processing (Java) |

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

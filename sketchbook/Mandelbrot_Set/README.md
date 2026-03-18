# Mandelbrot Set

## Overview
Interactive Mandelbrot explorer for:

`z_{n+1} = z_n^2 + c`, with `z_0 = 0`

visualising the set of complex values `c` for which the sequence remains bounded.

## Implementations
- `Processing_Java/` (modular Processing version)
- `p5_JS/` (modular browser version)

## Controls
- Pan and zoom navigation
- Iteration-depth adjustment
- Palette/colour-map selection

## How to Run

### Browser (p5.js)
```bash
cd sketchbook/Mandelbrot_Set/p5_JS
python3 -m http.server 8080
```
Open `http://localhost:8080`.

### Processing (Java)
Open `sketchbook/Mandelbrot_Set/Processing_Java/Mandelbrot_Set.pde` in Processing 4.x and click Run.

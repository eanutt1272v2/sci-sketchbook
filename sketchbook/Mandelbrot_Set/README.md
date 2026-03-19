# Mandelbrot Set

## Overview

Interactive Mandelbrot explorer for the quadratic recurrence:

- `z_0 = 0`
- `z_{n+1} = z_n^2 + c`

The sketch separates bounded from divergent complex values and supports deep interactive navigation.

## Method

Per pixel:
- Iterate the orbit with escape criterion `|z|^2 > 16`
- Stop at `maxIterations`
- Apply smooth colouring for non-interior points:
  - `logZn = 0.5 * log(zx^2 + zy^2)`
  - `nu = log(logZn / log(2)) / log(2)`
  - `t = (n + 1 - nu) / maxIterations`

Colours are sampled from polynomially generated LUT maps.

## Architecture

- `MandelbrotSet.js`: p5 sketch entrypoint
- `AppCore.js`: render state and worker request pipeline
- `FractalWorker.js`: pixel iteration kernel
- `FractalRenderer.js`: LUT generation and frame upload
- `InputHandler.js`: pan/zoom and keyboard interaction

## Controls

- Drag to pan
- Wheel/pinch to zoom
- Tune iteration depth
- Select colour map and export images

## Notes

- Worker rendering reduces main-thread stalls during high-iteration views.
- Zoom and pan are pointer-anchored for spatially stable navigation.

## Run

```bash
cd sketchbook/Mandelbrot_Set
python3 -m http.server 8080
```

Open `http://localhost:8080`.

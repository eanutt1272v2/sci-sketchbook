# Julia Set

## Overview

Interactive Julia-set explorer for

`z_{n+1} = z_n^2 + c`

with fixed complex parameter `c`, where each pixel supplies a distinct initial condition `z_0`.

## Method

Per pixel:

- Interpret the pixel coordinate as initial state `z_0`
- Iterate until escape or iteration cap
- Compute smooth escape-time colouring using the same interpolation strategy as Mandelbrot rendering

This approach does not encounter hard banding and produces a smooth and continuous gradient.

## Architecture

- `JuliaSet.js`: p5 sketch entrypoint
- `AppCore.js`: state and worker management
- `FractalWorker.js`: orbit-integration solver
- `FractalRenderer.js`: LUT and frame update pipeline
- `InputHandler.js`: pointer/touch/keyboard interaction

## Controls

- Drag/touch to pan
- Wheel/pinch to zoom
- Adjust iteration depth
- Switch palette and export

## Run

```bash
cd sketchbook/Julia_Set
python3 -m http.server 8080
```

Open `http://localhost:8080`.

# Burning Ship Fractal

## Overview

Interactive explorer of the Burning Ship fractal, a non-holomorphic quadratic map defined by absolute-value folding:

`z_{n+1} = (|Re(z_n)| + i|Im(z_n)|)^2 + c`

This folding breaks rotational symmetry and yields highly anisotropic geometry, including flame-like filaments and cusp chains.

## Method

For each pixel, the renderer maps canvas coordinates to a complex point `c`, iterates the recurrence, and applies an escape test (`|z|^2 > 16`) up to a maximum iteration cap.

Smooth colouring uses continuous escape-time interpolation:

- `logZn = 0.5 * log(zx^2 + zy^2)`
- `nu = log(logZn / log(2)) / log(2)`
- `t = (n + 1 - nu) / maxIterations`

The normalised parameter `t` is then mapped through a LUT to RGB.

## Architecture

- `BurningShipFractal.js`: p5 sketch entrypoint
- `AppCore.js`: state management, worker dispatch, UI manipulation
- `FractalWorker.js`: worker-based escape-time kernel
- `FractalRenderer.js`: LUT generation and framebuffer compositing
- `InputHandler.js`: robust pan/zoom controls

## Controls

- Drag to pan
- Wheel/pinch to zoom
- Adjust iteration depth via slider and step controls
- Switch colour maps via UI/shortcuts

## Run

```bash
cd sketchbook/Burning_Ship_Fractal
python3 -m http.server 8080
```

Open `http://localhost:8080`.

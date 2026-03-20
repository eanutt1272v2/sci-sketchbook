# Burning Ship Fractal

## Overview

Interactive explorer of the Burning Ship fractal, a non-holomorphic quadratic map defined by absolute-value folding:

`z_{n+1} = (|Re(z_n)| + i|Im(z_n)|)^2 + c`

Subsequently, this folding breaks the fractal's rotational symmetry and produces anisotropic (asymmetric) geometry, including flame-like filaments and cusp chains.

## Method

For each pixel, the renderer maps canvas coordinates to a complex point `c`, iterates the recurrence, and applies an escape test (`|z|^2 > 16`) up to a maximum iteration cap.

This implementation's smoothed colouring uses continuous escape-time interpolation as follows:

- `logZn = 0.5 * log(zx^2 + zy^2)`
- `nu = log(logZn / log(2)) / log(2)`
- `t = (n + 1 - nu) / maxIterations`

The normalised parameter `t` is then mapped through a LUT to an RGB value.

## Architecture

- `BurningShipFractal.js`: standard p5 sketch entrypoint
- `AppCore.js`: state management, worker management, UI initialisation/build
- `FractalWorker.js`: worker-based escape-time solver
- `FractalRenderer.js`: LUT generation and compositing
- `InputHandler.js`: robust pan/zoom controls

## Controls

- Drag to pan
- Wheel/pinch to zoom
- Adjust iteration depth via slider and step controls
- Switch colour maps via UI/keyboard

## Run

```bash
cd sketchbook/Burning_Ship_Fractal
python3 -m http.server 8080
```

Open `http://localhost:8080`.

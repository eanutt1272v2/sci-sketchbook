# Burning Ship Fractal

## Overview
Interactive explorer for the Burning Ship fractal:

`z_{n+1} = (|Re(z_n)| + i|Im(z_n)|)^2 + c`

This variant is known for its flame-like geometry and sharp filament detail.

## Implementations
- `Processing_Java/`
- `p5_JS/`

Both implementations use the same modular UI architecture (`AppCore`, `FractalRenderer`, input handling, and reusable UI widgets).

## Controls
- Pan and zoom on the complex plane
- Adjust iteration depth
- Switch colour mapping/palette

## Preview
![Burning Ship Fractal](Burning_Ship_Fractal.png)

## How to Run

### Browser (p5.js)
```bash
cd sketchbook/Burning_Ship_Fractal/p5_JS
python3 -m http.server 8080
```
Open `http://localhost:8080`.

### Processing (Java)
Open `sketchbook/Burning_Ship_Fractal/Processing_Java/Burning_Ship_Fractal.pde` in Processing 4.x and click Run.

# Julia Set

## Overview
Interactive Julia set explorer for the recurrence:

`z_{n+1} = z_n^2 + c`

with fixed complex parameter `c` and per-pixel iteration over the complex plane.

## Implementations
- `Processing_Java/` (modular Processing version)
- `p5_JS/` (modular browser version)

## Controls
- Pan: arrow keys or drag
- Zoom: keyboard and mouse wheel
- Iteration depth: UI slider/controls
- Palette: selectable colour maps
- UI visibility/reset shortcuts available in-app

## How to Run

### Browser (p5.js)
```bash
cd sketchbook/Julia_Set/p5_JS
python3 -m http.server 8080
```
Open `http://localhost:8080`.

### Processing (Java)
Open `sketchbook/Julia_Set/Processing_Java/Julia_Set.pde` in Processing 4.x and click Run.

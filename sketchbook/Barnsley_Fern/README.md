# Barnsley Fern

## Overview
Classic Barnsley fern generation using an iterated function system (IFS). The sketch applies four affine transformations with weighted probabilities to produce the fern structure.

## Implementations
- `Processing_Java/Barnsley_Fern.pde`
- `p5_JS/sketch.js`

## Controls
The sketch auto-renders points continuously. Render speed and density are configured in code.

## Preview
![Barnsley Fern](Fern_202631_153327.png)

## How to Run

### Browser (p5.js)
```bash
cd sketchbook/Barnsley_Fern/p5_JS
python3 -m http.server 8080
```
Open `http://localhost:8080`.

### Processing (Java)
Open `sketchbook/Barnsley_Fern/Processing_Java/Barnsley_Fern.pde` in Processing 4.x and click Run.

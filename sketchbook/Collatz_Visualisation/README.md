# Collatz Visualisation

## Overview
Visual rendering of Collatz trajectories (the `3n + 1` process) as branching geometric paths.

Each integer sequence is transformed into turns and segment lengths, producing tree-like forms from arithmetic behaviour.

## Implementation
- `sketch.js` (p5.js)

## Controls
The sketch runs automatically; visual tuning values are configured in source.

## How to Run

### Browser (p5.js/WebGL)
```bash
cd sketchbook/Collatz_Visualisation
python3 -m http.server 8080
```
Open `http://localhost:8080`.

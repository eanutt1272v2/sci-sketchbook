# Fluvia

## Overview
GPU-accelerated fluid and terrain simulation built with p5.js and GLSL.

The project combines interactive rendering with solver components for flow and erosion-style effects.

## Implementation
- JavaScript modules (`AppCore`, `Solver`, `Renderer`, `Terrain`, `Analyser`)
- Custom shaders (`vert.glsl`, `frag.glsl`)

## Controls
- GUI controls for simulation parameters
- Camera controls for scene inspection
- Visual analysis overlays and render settings

## How to Run

### Browser (p5.js/WebGL)
```bash
cd sketchbook/Fluvia
python3 -m http.server 8080
```
Open `http://localhost:8080`.

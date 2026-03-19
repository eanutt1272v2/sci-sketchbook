# Fluvia

## Overview
Fluvia is a fast web-based geomorphological simulation (due to various optimisations, a worker script, and partial GPU-acceleration via a GLSL shader). It utilises a Lagrangian particle-based fallbacksolver in which water droplets traverse a dual-layer heightmap of bedrock and sediment. As a result of simulating momentum-based transport, deposition, and evaporation physics to a sufficient degree of accuracy, it generates realistic fluvial features like drainage basins, serpentine, meandering rivers, and alluvial fans.

Algorithm originally by Nick McDonald: <https://www.nickmcd.me/2023/12/12/meandering-rivers-in-particle-based-hydraulic-erosion-simulations>

## Implementation
- JavaScript modules (`AppCore`, `FallbackSolver`, `Renderer`, `Terrain`, `Analyser`)
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

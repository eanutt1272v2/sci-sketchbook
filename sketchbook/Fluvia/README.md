# Fluvia

## Overview

Fluvia is a fast web-based geomorphological simulation. It utilises a Lagrangian particle-based solver in which water droplets traverse a dual-layer heightmap of bedrock and sediment. As a result of simulating momentum-based transport, deposition, and evaporation physics, it generates realistic fluvial features such as drainage basins, meandering rivers, and alluvial fans.

Algorithm by Nick McDonald: <https://www.nickmcd.me/2023/12/12/meandering-rivers-in-particle-based-hydraulic-erosion-simulations>

## Method

The complete terrain state is represented by coupled scalar fields/maps:

- bedrock elevation
- sediment depth
- total surface height
- flow/discharge

Droplets fall down local slopes and exchange mass with the surface through erosion and deposition processes, and momentum and evaporation control the transport length and channel persistence.

Each simulation cycle follows this basic loop:

1. Spawn many droplets over the terrain (rainfall approximation).
2. Move each droplet downslope using local gradient/normal data calculated from state maps.
3. Compute transport capacity from slope, local flow, and droplet state.
4. Erode where droplet capacity exceeds carried sediment; deposit where it does not.
5. Update flow/discharge tracking maps from particle paths.
6. Apply evaporation and terminate droplets that become too small or leave terrain area.

### Meandering Rivers!

Meandering is mainly driven by two reinforcing processes:

- Higher effective flow at outer bends increases suspension/erosion.
- Lower effective flow at inner bends increases deposition.

This behaviour is strengthened by introducing stream-level momentum coupling (approximated from accumulated particle motion), which gives curved channels some directional persistence. Tiny curvature disturbances then give rise to positive feedback loops, thus producing evident migrating bends, cut-off events, and meander scarring in the surface of the terrain.

## Architecture

- `AppCore.js`: simulation lifecycle and worker management
- `FluviaWorker.js`: worker-based hydraulic+thermal solver
- `Terrain.js`: typed-array terrain field storage
- `Renderer.js`: 2D/3D rendering and partially shader-based render pipeline
- `FallbackAnalyser.js`: terrain and hydrology statistics
- `Camera.js`, `GUI.js`, `InputHandler.js`, `Media.js`: interaction and export systems
- `vert.glsl`, `frag.glsl`: texture application shaders (used in 3D render mode)

## Controls

- Pause/resume and regenerate terrain
- Edit droplet count and erosion parameters
- Switch surface visualisations and colour maps
- Orbit/zoom camera in 3D mode
- Export image/video/world state

## Notes

- Parameter changes can change landscape morphology drastically (e.g. broad basins or incised river networks).

## References

- Meandering rivers and momentum-coupled improvements: <https://www.nickmcd.me/2023/12/12/meandering-rivers-in-particle-based-hydraulic-erosion-simulations>
- Simple particle-based hydraulic erosion: <https://nickmcd.me/2020/04/10/simple-particle-based-hydraulic-erosion/>

## Run

```bash
cd sketchbook/Fluvia
python3 -m http.server 8080
```

Open `http://localhost:8080`.

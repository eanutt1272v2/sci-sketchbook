# Cellular Division

## Overview

An advanced, rebuilt web-based, worker-accelerated implementation of the Primordial Particle System (PPS), an artificial-life model sourced from research by Schmickl et al. (2016). By applying a singular motion law, wherein identical particles steer based only on local neighbourhood density, the system demonstrates spontaneous emergence of cellular structures that exhibit a coherent virtual "cell cycle".

## Method

Each particle tracks heading and local neighbourhood counts in directional left-right regions. Turning is controlled by left-right density differences:

- `turnDirection = sign(rightCount - leftCount)`
- `turn = alpha + beta * neighbourCount * turnDirection`
- `theta <- theta + turn`

Particle speed is controlled by `radius` and `gamma`:

- `velocity = (radius * gamma) / 100`

The position update is then:

- `x <- x + velocity * cos(theta)`
- `y <- y + velocity * sin(theta)`

The simulation domain is toroidal (wraparound), so particles crossing one boundary re-enter from the opposite side.

Schmickl, T., Stefanec, M. & Crailsheim, K. How a life-like system emerges from a simplistic particle motion law. Sci Rep 6, 37969 (2016). <https://doi.org/10.1038/srep37969>

## Architecture

- `Simulation.js`: main loop, worker data transfer, and rendering pipeline
- `SimulationWorker.js`: worker-based particle stepping and cell population tracking
- `Particle.js`, `Species.js`, `Grid.js`, `CellTracker.js`: simulation primitives and analysis support
- `UIManager.js`, `LeftPanel.js`, `RightPanel.js`: parameter and statistics UI

## Controls

- Restart and pause/play
- Tune alpha, beta, gamma, radius
- Tune trail alpha and density threshold
- Change particle count (restart required to apply)

## Notes

- Particle populations often show rapid multiplication followed by plateauing as local density gradients flatten.
- Neighbourhood radius and turning parameters (`alpha`, `beta`) strongly influence whether behaviour remains diffuse or forms, dividing bodies.
- Worker stepping keeps the main thread responsive during heavy updates.

## Run

```bash
cd sketchbook/Cellular_Division
python3 -m http.server 8080
```

Open `http://localhost:8080`.

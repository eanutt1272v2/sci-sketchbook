# Cellular Division

Worker-accelerated implementation of the Primordial Particle System (PPS), an artificial-life model in which identical particles, governed by a single local turning rule, spontaneously self-organise into dividing cell-like structures.

* p5.js 2.2.3
* Web Worker (particle stepping & population tracking)
* Spatial hashing (O(1) neighbourhood queries)

## Model computations

* Density-driven steering with left–right neighbourhood classification.
* Toroidal (wraparound) simulation domain.
* Connected-component flood-fill for cell population counting.
* Adaptive frame-pacing with worker-based particle stepping.

---

## Project Files

* [CellularDivision.js — Configuration constants and metadata](CellularDivision.js)
* [sim/Simulation.js — Main simulation loop, rendering, and worker management](sim/Simulation.js)
* [worker/SimulationWorker.js — Worker-side particle stepping and population analysis](worker/SimulationWorker.js)
* [sim/Particle.js — Particle data structure and per-particle state](sim/Particle.js)
* [sim/Species.js — Parameter transformation and velocity computation](sim/Species.js)
* [sim/Grid.js — Spatial hash grid for efficient neighbourhood queries](sim/Grid.js)
* [sim/CellTracker.js — Connected-component cell population counter](sim/CellTracker.js)
* [core/ParameterSet.js — Parameter definitions, ranges, and defaults](core/ParameterSet.js)
* [core/AppCore.js — Application lifecycle and theme management](core/AppCore.js)
* [ui/UIManager.js — UI orchestration and panel layout](ui/UIManager.js)
* [ui/InputHandler.js — Keyboard, slider, and text-input handling](ui/InputHandler.js)

### Folder Structure

```text
Cellular_Division/
├─ index.html
├─ CellularDivision.js
├─ core/
│  ├─ AppCore.js
│  └─ ParameterSet.js
├─ sim/
│  ├─ Simulation.js
│  ├─ Species.js
│  ├─ Particle.js
│  ├─ Grid.js
│  └─ CellTracker.js
├─ ui/
│  ├─ Theme.js
│  ├─ UIManager.js
│  ├─ LeftPanel.js
│  ├─ RightPanel.js
│  ├─ InputHandler.js
│  └─ components/
│     ├─ Button.js
│     ├─ Slider.js
│     ├─ AccordionPanel.js
│     └─ AccordionGroup.js
└─ worker/
    └─ SimulationWorker.js
```

---

## Content

### Theoretical Background

* [Primordial Particle Systems](#1-primordial-particle-systems)
* [The Steering Rule](#2-the-steering-rule)
* [Toroidal Domain](#3-toroidal-domain)
* [Cell Population Detection](#4-cell-population-detection)
* [Model Parameters](#5-model-parameters)

### Implementation

* [Architecture](#6-architecture)
* [Controls](#7-controls)
* [References](#references)

---

### 1. Primordial Particle Systems

The Primordial Particle System (PPS) is a minimal artificial-life model introduced by Schmickl, Stefanec & Crailsheim (2016). A population of identical particles moves on a continuous 2D plane. Each particle
has a position $(x, y)$, a heading $\theta$, and no memory beyond a single-frame neighbourhood count. Despite this extreme simplicity, the model reliably produces emergent structures that undergo a coherent virtual cell cycle: nucleation, growth, elongation, and division.

The key insight is that a single, deterministic turning rule — based only on the
difference between left-side and right-side neighbour counts — is sufficient to
drive particles into dense rotating clusters that spontaneously divide once they
exceed a critical size.

---

### 2. The Steering Rule

Each particle senses all neighbours within a radius $r$ and classifies them into
left and right half-planes relative to its current heading. The classification
uses a cross-product test:

$$\text{side}(dx, dy) = dx \sin\theta - dy \cos\theta$$

where $(dx, dy)$ is the wrapped displacement from the focal particle to a
neighbour. Positive values indicate the right half-plane; negative values
indicate the left.

#### 2.1 Neighbourhood Counting

For each particle, three counts are maintained per frame:

| Count | Definition |
| :-- | :-- |
| $N$ | Total neighbours with $d^2 \leq r^2$ |
| $N_L$ | Neighbours in the left half-plane |
| $N_R$ | Neighbours in the right half-plane |

An additional close-proximity count ($d^2 \leq 15.21$, i.e. 3.9 px) is tracked for
rendering purposes.

#### 2.2 Turn Computation

The angular update combines a constant base rotation with a density-modulated
differential term:

$$\Delta\theta = \alpha + \beta \cdot N \cdot \text{sgn}(N_R - N_L)$$

where:

* $\alpha$ is the base turning angle (radians, converted from degrees).
* $\beta$ is the turn multiplier per neighbour (radians, converted from degrees).
* $\text{sgn}(\cdot)$ returns $+1$, $-1$, or $0$.

The heading is then updated modulo $2\pi$:

$$\theta \leftarrow (\theta + \Delta\theta) \bmod 2\pi$$

#### 2.3 Position Update

Velocity is a scalar derived from the sensing radius and a scaling coefficient:

$$v = \frac{r \cdot \gamma}{100}$$

The position advances along the heading with toroidal wrapping:

$$x \leftarrow \text{wrap}(x + v \cos\theta,\; W)$$
$$y \leftarrow \text{wrap}(y + v \sin\theta,\; H)$$

#### 2.4 High-Density Classification

A particle is flagged as *high-density* when its neighbourhood count meets or
exceeds a density threshold $\rho$:

$$\text{highDensity} = (N \geq \rho)$$

Only high-density particles participate in the cell population analysis.

---

### 3. Toroidal Domain

The simulation domain wraps in both axes, forming a flat torus. Two wrapping
functions handle coordinates and inter-particle distances:

Coordinate wrapping:

$$\text{wrap}(v, D) = \begin{cases} v + D & v < 0 \\ v - D & v \geq D \\ v & \text{otherwise} \end{cases}$$

Distance wrapping (shortest path across boundaries):

$$\text{wrapDist}(d, D) = \begin{cases} d - D & d > D/2 \\ d + D & d < -D/2 \\ d & \text{otherwise} \end{cases}$$

The spatial hash grid also wraps cell lookups, so neighbourhood queries near
edges are seamless.

---

### 4. Cell Population Detection

Every 15 frames, a connected-component analysis identifies discrete "cells" among
the high-density particles.

#### 4.1 Flood-Fill Algorithm

Starting from each unvisited high-density particle, a stack-based flood fill
marks all reachable high-density neighbours (within $r^2$) as belonging to the
same component. The 3×3 spatial grid neighbourhood is scanned at each step:

```psuedocode
floodFill(seed):
    stack ← [seed]
    seed.visited ← true
    while stack not empty:
        current ← stack.pop()
        for each neighbour in 3×3 grid around current:
            if not visited AND highDensity AND d² ≤ r²:
                neighbour.visited ← true
                stack.push(neighbour)
```

The number of distinct components equals the cell population at that frame. A
rolling history of population counts is maintained for graphing.

---

### 5. Model Parameters

* Alpha ($\alpha$): base turning angle in degrees. Default `180`, range `0–360`.
* Beta ($\beta$): turn multiplier per neighbour in degrees. Default `17`, range `0–180`.
* Gamma ($\gamma$): velocity scaling coefficient. Default `13.4`, range `0–100`.
* Radius ($r$): sensing radius in pixels. Default `15`, range `1–100`.
* Trail Alpha ($\tau$): motion-blur transparency (`0` = full trail). Default `200`, range `0–255`.
* Density ($\rho$): neighbour threshold for high-density flag. Default `20`, range `1–100`.
* Particles ($P$): total particle count. Default `$\lfloor WH / 120.96 \rfloor$`, range `100–20 000`.

> [!NOTE]
> The default particle count is calibrated to canvas area, maintaining roughly
> uniform density across window sizes. Changes to particle count require a
> simulation restart.

---

### 6. Architecture

#### 6.1 Spatial Hash Grid

A uniform grid with 30 px cell size partitions the domain. Each frame, all
particles are inserted into their grid cell. Neighbourhood queries scan only the
3×3 block of cells surrounding the focal particle, yielding $O(1)$ amortised
lookup cost.

```text
columns = ⌈W / 30⌉,  rows = ⌈H / 30⌉
```

Grid cell access wraps toroidally:

$$\text{cell}(g_x, g_y) = \text{cells}[((g_x \bmod C) + C) \bmod C][((g_y \bmod R) + R) \bmod R]$$

#### 6.2 Worker Pipeline

Heavy per-particle computation is offloaded to a dedicated Web Worker:

1. Main thread sends a `"restart"` message with parameters and canvas
   dimensions.
2. Each frame, the main thread posts `"tick"`.
3. The worker clears the grid, inserts particles, counts neighbourhoods,
   updates headings and positions, runs cell tracking, and packs results into a
   `Float32Array` (4 floats per particle: $x$, $y$, close count, neighbour count).
4. The buffer is transferred back with ownership (zero-copy).
5. The main thread renders particles from the buffer and renders the motion trail.

Adaptive frame-pacing adjusts the step interval (22–30 ms base) by ±2 ms to
maintain ≈60 FPS.

#### 6.3 Rendering

Particles are coloured by neighbourhood density:

| Condition | Colour |
| :-- | :-- |
| Close neighbours > 15 | Magenta $(255, 80, 255)$ |
| $N > 35$ | Yellow $(255, 255, 100)$ |
| $N > 15$ | Blue $(0, 0, 255)$ |
| $N \geq 13$ | Orange $(180, 100, 50)$ |
| Default | Green $(80, 255, 80)$ |

A translucent rectangle with alpha $\tau$ is rendered each frame to produce a
configurable motion trail.

#### 6.4 UI Panels

Left panel — statistics (FPS, elapsed time, cell population), simulation
controls (restart, pause/play, particle count), and a live population graph.

Right panel — six parameter sliders ($\alpha$, $\beta$, $\gamma$, $r$, $\tau$, $\rho$) with
click-to-type value entry and ±step buttons.

---

### 7. Controls

#### 7.1 Simulation

| Key | Action |
| :-- | :-- |
| `R` | Restart simulation |
| `P` / `Space` | Pause / resume |
| `H` | Toggle UI panels |
| `#` | Toggle keymap reference overlay |

#### 7.2 Parameter Adjustment

All parameter keys accept `Shift` for a 10× step multiplier.

| Keys | Parameter | Step |
| :--: | :-------: | :--: |
| `1` / `2` | $\alpha$ | ±1° (±10°) |
| `3` / `4` | $\beta$ | ±1° (±10°) |
| `5` / `6` | $\gamma$ | ±0.1 (±1.0) |
| `7` / `8` | $r$ | ±1 px (±10 px) |
| `9` / `0` | $\tau$ | ±5 (±50) |
| `-` / `=` | $\rho$ | ±1 (±10) |
| `[` / `]` | Particle count | ±100 (±1000) |

#### 7.3 Import / Export

| Keys | Action |
| :-- | :-- |
| `Shift+I` | Import parameters (JSON) |
| `Shift+P` | Export parameters (JSON) |
| `Shift+J` | Export statistics (JSON) |
| `Shift+K` | Export statistics (CSV) |
| `Shift+S` | Export full state (JSON) |
| `Shift+O` | Import full state (JSON) |

---

### References

* Schmickl, T., Stefanec, M. & Crailsheim, K. How a life-like system emerges from a simplistic particle motion law. *Sci Rep* 6, 37969 (2016). <https://doi.org/10.1038/srep37969>
* Schmickl, T., Stefanec, M. & Crailsheim, K. Correction: Corrigendum: How a life-like system emerges from a simple particle motion law. *Sci Rep* 7, 42454 (2017). <https://doi.org/10.1038/srep42454>

---

### Run

```bash
cd library/Cellular_Division
python3 -m http.server 8080
```

Open `http://localhost:8080`.

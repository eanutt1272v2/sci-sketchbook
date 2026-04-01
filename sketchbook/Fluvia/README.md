# Fluvia

Lagrangian particle-based hydraulic erosion simulation with momentum-coupled meandering, thermal diffusion, and a dual-layer bedrock–sediment terrain model. Water droplets traverse a heightmap, eroding bedrock, transporting sediment, and depositing material to produce realistic fluvial landforms such as drainage basins, meandering rivers, alluvial fans, and meander scarring.

* p5.js 1.x (2D & WebGL 3D rendering)
* Web Worker (hydraulic + thermal solver)
* GLSL shaders (3D terrain mesh with dynamic lighting)
* Tweakpane 4.x (parameter interface)

## Model computations

* Gradient-driven droplet advection with momentum-coupled velocity.
* Capacity-limited erosion and deposition on separate bedrock and sediment layers.
* Exponential moving-average discharge and momentum fields for stream persistence.
* Thermal erosion via eight-neighbour slope relaxation.
* Perlin-noise terrain generation with octave control.

---

## Project Files

* [Fluvia.js — p5.js lifecycle and configuration](Fluvia.js)
* [AppCore.js — Simulation lifecycle, worker management, and state coordination](AppCore.js)
* [FluviaWorker.js — Worker-side hydraulic and thermal erosion solver](FluviaWorker.js)
* [Terrain.js — Typed-array terrain field storage and noise generation](Terrain.js)
* [Renderer.js — 2D pixel rendering and 3D shader-based terrain mesh](Renderer.js)
* [Camera.js — Quaternion-based 3D orbit camera](Camera.js)
* [Quaternion.js — Quaternion algebra for camera rotation](Quaternion.js)
* [Analyser.js — Topographic, hydrological, and mass-balance statistics](Analyser.js)
* [GUI.js — Tweakpane parameter interface (5 tabs)](GUI.js)
* [InputHandler.js — Keyboard, mouse, and touch input](InputHandler.js)
* [Media.js — Image, video, heightmap, and world-state import/export](Media.js)
* [RLECodec.js — Run-length encoding for Float32Array map serialisation](RLECodec.js)

---

## Content

### Theoretical Background

* [Hydraulic Erosion Model](#1-hydraulic-erosion-model)
* [Droplet Dynamics](#2-droplet-dynamics)
* [Erosion and Deposition](#3-erosion-and-deposition)
* [Momentum-Coupled Meandering](#4-momentum-coupled-meandering)
* [Thermal Erosion](#5-thermal-erosion)
* [Terrain State Fields](#6-terrain-state-fields)
* [Model Parameters](#7-model-parameters)

### Implementation

* [Architecture](#8-architecture)
* [Interaction and Controls](#9-interaction-and-controls)
* [References](#references)

---

## 1. Hydraulic Erosion Model

Fluvia implements a Lagrangian particle approach wherein which many short-lived water droplets are spawned on a terrain surface each frame. Each droplet carries a volume, a velocity, and a sediment load. As it flows downhill under gravity, it erodes material where its capacity exceeds its load, and deposits material where its load exceeds capacity. Over many thousands of droplet lifetimes, the cumulative effect reshapes the terrain into geomorphologically plausible landforms.

The terrain is represented by two coupled scalar fields — bedrock elevation and sediment depth — whose sum gives the total surface height. A persistent discharge field records accumulated water flow, and a persistent momentum field $(\mathbf{p}_x, \mathbf{p}_y)$ records flow direction. They are both updated via an exponential moving average, subsequently providing the directional memory that allows for river meandering.

---

## 2. Droplet Dynamics

Each simulation frame spawns $N$ droplets at uniformly random positions with zero initial velocity.

### 2.1 Surface Normal

The local gradient is estimated by central finite differences on the total height field $h$:

$$\Delta_x = h(x{-}1, y) - h(x{+}1, y), \qquad \Delta_z = h(x, y{-}1) - h(x, y{+}1)$$

$$\mathbf{n} = \frac{(\Delta_x \cdot H_s,\; 1,\; \Delta_z \cdot H_s)}{|(\Delta_x \cdot H_s,\; 1,\; \Delta_z \cdot H_s)|}$$

where $H_s$ is the height scale factor. At domain boundaries, one-sided differences are used.

### 2.2 Velocity Update

Gravity accelerates the droplet along the surface normal, inversely weighted by volume:

$$v_x \mathrel{+}= \frac{g \cdot n_x}{V}, \qquad v_y \mathrel{+}= \frac{g \cdot n_z}{V}$$

where $g$ is the gravity parameter and $V$ is the current droplet volume.

### 2.3 Velocity Normalisation

After momentum coupling (§4), the velocity vector is rescaled to a fixed diagonal magnitude:

$$\text{mag} = \sqrt{v_x^2 + v_y^2}$$

$$v_x \mathrel{*}= \frac{\sqrt{2}}{\text{mag}}, \qquad v_y \mathrel{*}= \frac{\sqrt{2}}{\text{mag}}$$

This ensures that droplets advance at most one cell diagonally per step, preventing tunnelling issues (that plague some other implementations).

### 2.4 Evaporation

Every step, the droplet's volume and carried sediment decay exponentially by:

$$V \leftarrow V \cdot (1 - \epsilon), \qquad S \leftarrow S \cdot (1 - \epsilon)$$

where $\epsilon$ is the evaporation rate. The droplet is terminated when $V < V_{\min}$ or its age exceeds $t_{\max}$.

---

## 3. Erosion and Deposition

Transport capacity $C$ determines whether a droplet erodes or deposits at its current position:

$$C = \max\!\Big(0,\;\big(1 + \eta \cdot \text{erf}(0.4 \cdot D_i)\big) \cdot \Delta h\Big)$$

where:

* $\eta$ is the entrainment coefficient.
* $D_i$ is the raw accumulated discharge at cell $i$.
* $\text{erf}$ is the Gauss error function (Cody rational approximation).
* $\Delta h = h_{\text{start}} - h_{\text{end}}$ is the elevation drop to the next cell.

### 3.1 Erosion

When $C > S$ (capacity exceeds sediment load), the deficit is filled first from the sediment layer, then from bedrock:

$$S_{\text{from\,sed}} = \min(S_{\text{map}}[i],\; (C - S) \cdot e_s)$$

$$S_{\text{from\,bed}} = \Big((C - S) - S_{\text{from\,sed}} / e_s\Big) \cdot e_b$$

where $e_s$ and $e_b$ are the sediment and bedrock erosion rates, respectively.

### 3.2 Deposition

When $C < S$ (load exceeds capacity), excess sediment is deposited onto the sediment layer:

$$\text{deposit} = (S - C) \cdot d_r$$

where $d_r$ is the deposition rate. The total height at the cell is recomputed after each transfer.

---

## 4. Momentum-Coupled Meandering

Realistic river meandering emerges from coupling each droplet's velocity to the persistent momentum field. The momentum field accumulates droplet motion at each cell via an exponential moving average:

$$\mathbf{p}[i] \leftarrow (1 - \lambda)\,\mathbf{p}[i] + \lambda\,\mathbf{p}_{\text{track}}[i]$$

where $\lambda$ is the learning rate and $\mathbf{p}_{\text{track}}$ is the per-frame momentum accumulator (reset each step).

At each droplet step, the velocity is adjusted by the local momentum:

$$a = \frac{\mathbf{p}[i] \cdot \mathbf{v}}{|\mathbf{p}[i]| \cdot |\mathbf{v}|}$$

$$\tau = \frac{\mu_t \cdot a}{V + D[i]}$$

$$v_x \mathrel{+}= \tau \cdot p_x[i], \qquad v_y \mathrel{+}= \tau \cdot p_y[i]$$

where $\mu_t$ is the momentum transfer coefficient and $a$ is the alignment between the droplet's velocity and the stored momentum. This creates a positive feedback loop wherein a slight curvature in a channel biases future droplets to reinforce the bend, producing progressively tighter meanders, cut-off *'pinching'* events, very transient oxbow-lake features, and ultimately scarring in the surface of the terrain.

---

## 5. Thermal Erosion

After each hydraulic step, thermal erosion relaxes steep slopes at the droplet's location. For each of eight neighbours (cardinal distance = 1, diagonal = $\sqrt{2}$):

$$\text{excess} = |h_i - h_j| - d_{ij} \cdot \Delta h_{\max}$$

If $\text{excess} > 0$:

$$\text{transfer} = \frac{\sigma \cdot \text{excess}}{2}$$

The transfer amount is subtracted from the higher cell and added to the lower, drawing first from the sediment layer and then from bedrock. This mitigates the formation of unrealistically vertical and exaggerated cliffs.

---

## 6. Terrain State Fields

All fields are stored as `Float32Array` of size $N \times N$ where $N$ is the terrain resolution:

| Field | Purpose |
| :-- | :-- |
| `heightMap` | Total aggregated surface elevation (bedrock + sediment) |
| `bedrockMap` | Bedrock layer elevation |
| `sedimentMap` | Accumulated sediment depth |
| `originalHeightMap` | Initial bedrock (for delta visualisation and reset) |
| `dischargeMap` | Smoothed cumulative water flow (erf-normalised, ie. error function) |
| `momentumX`, `momentumY` | Separated persistent flow direction components |
| `dischargeTrack` | Per-step discharge accumulator (resets each frame) |
| `momentumXTrack`, `momentumYTrack` | Per-step momentum accumulators, akin to previous |

### 6.1 Terrain Generation

Initial terrain is produced by Perlin noise with tunable scale, octave count, and amplitude falloff, followed by a $\gamma = 1.2$ power correction and min–max normalisation to $[0, 1]$.

---

## 7. Model Parameters

### 7.1 Simulation Control

| Parameter | Default | Range | Description |
| :-- | :--: | :--: | :-- |
| `dropletsPerFrame` | 256 | 0–512 | Droplets spawned each frame |
| `maxAge` | 500 | 128–512 | Maximum droplet lifetime (steps) |
| `minVolume` | 0.01 | 0.001–0.1 | Volume threshold for termination |

### 7.2 Hydraulic Erosion

| Parameter | Symbol | Default | Range |
| :-- | :--: | :--: | :--: |
| Sediment erosion rate | $e_s$ | 0.1 | 0–0.2 |
| Bedrock erosion rate | $e_b$ | 0.1 | 0–0.2 |
| Deposition rate | $d_r$ | 0.1 | 0–0.2 |
| Evaporation rate | $\epsilon$ | 0.001 | 0.001–1 |
| Precipitation rate | — | 1 | 0–5 |
| Entrainment | $\eta$ | 1 | 0–10 |
| Gravity | $g$ | 1 | 0.1–5 |
| Momentum transfer | $\mu_t$ | 1 | 0–4 |

### 7.3 Thermal Erosion

| Parameter | Symbol | Default | Range |
| :-- | :--: | :--: | :--: |
| Max height difference | $\Delta h_{\max}$ | 0.01 | 0.01–1 |
| Settling rate | $\sigma$ | 0.8 | 0–1 |

### 7.4 Terrain Generation

| Parameter | Default | Range |
| :-- | :--: | :--: |
| Terrain size | 256 | 128, 256, 512 |
| Noise scale | 0.6 | 0.1–5 |
| Noise octaves | 8 | 1–12 |
| Amplitude falloff | 0.6 | 0–1 |

### 7.5 Rendering

| Parameter | Default | Options |
| :-- | :--: | :-- |
| Render method | 3D | 2D, 3D |
| Surface map | Composite | Composite, Height, Slope, Discharge, Sediment, Delta |
| Colour map | viridis | All loaded LUTs |
| Height scale | 100 | 1–256 |

> [!NOTE]
> The composite surface map is for cosmetic and visual purposes and it *'composites'* slope-weighted terrain colour, sediment overlay, and water overlay with optional specular highlights when rendering in 3D. Five RGB palette colours (sky, steep, flat, sediment, water) can be customised independently.

---

## 8. Architecture

### 8.1 Worker Pipeline

Each frame, the main thread transfers all nine terrain `ArrayBuffer`s to the web worker with ownership (zero-copy). The worker executes $N$ droplet lifecycles, simulates thermal erosion, computes analysis statistics, and returns the buffers:

```text
Main                          Worker
  │─── step(params, buffers) ──→│
  │                             │  for each droplet:
  │                             │    advect, erode/deposit,
  │                             │    update discharge & momentum
  │                             │  thermal erosion pass
  │                             │  analysis pass
  │←── result(buffers, stats) ──│
```

### 8.2 3D Rendering Pipeline

In '3D' mode, the terrain is rendered as a height-displaced quad mesh via a two-pass GLSL pipeline:

1. Vertex shader: displaces mesh vertices by the height texture.
2. Fragment shader: samples the composite texture (pre-rendered on the CPU from terrain maps and palette colours).
3. The specular highlights are calculated from a half-vector dot product a dedicated parameter for controlling intensity.

The camera uses quaternion object based orbit control with smooth interpolation ($\text{lerp weight} = 0.25$ per frame).

### 8.3 Statistics Engine

Per-frame analysis computes 30+ metrics across four categories:

| Category | Metrics |
| :-- | :-- |
| Topography | Mean/std-dev elevation, min/max height, rugosity (surface area / cell count), slope complexity |
| Hydrology | Total water volume, active water cells, drainage density (%), hydraulic residence time, discharge bounds |
| Mass balance | Erosion rate (vol/s), sediment flux (vol/s), total sediment, total bedrock |
| Composite | Supplementary water/sediment/flat/steep coverage (%), mean slope weight, mean sediment alpha, mean water alpha |

---

## 9. Interaction and Controls

### 9.1 Simulation

| Key | Action |
| :-- | :-- |
| `P` / `Space` | Pause / resume |
| `G` | Generate new terrain |
| `R` | Reset terrain (undo erosion) |
| `I` / `K` | Droplets per frame ±16 |

### 9.2 Rendering

| Key | Action |
| :-- | :-- |
| `1` / `2` | Switch to 2D / 3D |
| `M` | Cycle surface map (`Shift` = reverse) |
| `C` | Cycle colour map (`Shift` = reverse) |
| `[` / `]` | Height scale ±4 (`{`/`}` = ±16) |
| `O` | Toggle statistics overlay |
| `L` | Toggle legend |

### 9.3 Camera (3D only)

| Key | Action |
| :-- | :-- |
| `W` / `S` / `A` / `D` | Orbit pitch / yaw (`Shift` = 2× speed) |
| `Q` / `E` | Zoom out / in (`Shift` = 2× speed) |
| Mouse drag | Orbit |
| Scroll wheel | Zoom |
| Two-finger pinch | Zoom (touch) |

### 9.4 Import / Export

| Key | Action |
| :-- | :-- |
| `F` | Export image |
| `V` | Start / stop recording |
| `U` | Import heightmap image |
| `Shift+I` | Import parameters (JSON) |
| `Shift+P` | Export parameters (JSON) |
| `Shift+J` | Export statistics (JSON) |
| `Shift+K` | Export statistics (CSV) |
| `Shift+W` | Export world state (JSON + maps) |
| `Shift+Q` | Import world state (JSON) |

| Key | Action |
| :-- | :-- |
| `H` | Toggle GUI panel |
| `#` | Toggle keymap reference overlay |

---

## References

* McDonald, N. Meandering rivers in particle-based hydraulic erosion simulations (2023). <https://www.nickmcd.me/2023/12/12/meandering-rivers-in-particle-based-hydraulic-erosion-simulations>
* McDonald, N. Simple particle-based hydraulic erosion (2020). <https://nickmcd.me/2020/04/10/simple-particle-based-hydraulic-erosion/>

---

## Run

```bash
cd sketchbook/Fluvia
python3 -m http.server 8080
```

Open `http://localhost:8080`.

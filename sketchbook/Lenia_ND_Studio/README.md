# Lenia ND Studio

FFT-accelerated continuous cellular automaton studio implementing Lenia with configurable kernel and growth function families, multi-shell convolution, and full 2D, 3D, and 4D support. Includes a curated organism catalogue with taxonomic classification and tools for exploring the parameter space of smooth life-like dynamics.

* p5.js 1.x
* Web Worker (FFT convolution, kernel construction, analysis)
* Tweakpane 4.x (parameter interface)
* Radix-2 FFT (Cooley–Tukey, N-dimensional pencil decomposition)

## Model computations

* Radially-symmetric multi-shell kernel with four selectable core functions.
* Three growth function families (polynomial, exponential, step).
* FFT-based convolution for $O(N^2 \log N)$ stepping.
* Precomputed growth lookup tables with linear sub-LUT interpolation.
* Connected multi-step integration (3rd-order BDF approximation) and Arita dampening modes.
* 40+ per-frame statistics including symmetry detection, moment invariants, and periodicity analysis.

---

## Project Files

* [LeniaNDStudio.js — p5.js lifecycle and asset loading](LeniaNDStudio.js)
* [AppCore.js — Application controller, worker orchestration, and parameter management](AppCore.js)
* [LeniaWorker.js — FFT solver, kernel builder, growth LUTs, and analysis pipeline](LeniaWorker.js)
* [Automaton.js — Kernel state container and sparse representation](Automaton.js)
* [Board.js — Grid storage, pattern loading, scaling, and transformation](Board.js)
* [Renderer.js — World/potential/growth/kernel rendering with LUT, overlays, and polar modes](Renderer.js)
* [AnimalLibrary.js — Organism preset manager and parameter application](AnimalLibrary.js)
* [GUI.js — Tweakpane interface (6 tabs)](GUI.js)
* [InputHandler.js — Keyboard, mouse, and touch controls](InputHandler.js)
* [Analyser.js — Statistics, symmetry detection, moment invariants, periodicity](Analyser.js)
* [Media.js — World/parameter/statistics import and export, image/video capture](Media.js)
* [NDCompatibility.js — N-dimensional configuration and grid-size constraints](NDCompatibility.js)

---

## Content

### Theoretical Background

* [Continuous Cellular Automata](#1-continuous-cellular-automata)
* [The Lenia Update Rule](#2-the-lenia-update-rule)
* [Kernel Function](#3-kernel-function)
* [Growth Function Families](#4-growth-function-families)
* [Time Integration Modes](#5-time-integration-modes)
* [N-Dimensional Extension](#6-n-dimensional-extension)
* [Model Parameters](#7-model-parameters)

### Implementation

* [Architecture](#8-architecture)
* [Controls](#9-controls)
* [References](#references)

---

### 1. Continuous Cellular Automata

Lenia (from Latin *lenis*, smooth) is a family of continuous cellular automata introduced by Bert Wang-Chak Chan (2019). Unlike binary automata such as Conway's Game of Life, Lenia operates on a continuous state field $A_t(x) \in [0,1]$, uses a smooth radially-symmetric convolution kernel, and maps the convolution output through a continuous growth function. This combination produces a rich taxonomy of self-organising structures such as gliders, oscillators, multi-armed rotators, and travelling organisms — that are qualitatively more life-like than their discrete counterparts.

The key parameters are the interaction radius $R$, the time scale $T$, the growth centre $m$ (preferred local density), and the growth width $s$ (tolerance around $m$). Small changes in these four values can produce qualitatively different outcomes: extinction, stable motion, oscillation, or unbounded growth.

---

### 2. The Lenia Update Rule

Each timestep executes three operations on the field $A_t$:

#### 2.1 Convolution (Potential)

The local potential $U_t(x)$ is obtained by convolving the field with a normalised kernel $K$:

$$U_t(x) = (K * A_t)(x) = \sum_{y} K(y)\, A_t(x - y)$$

For efficiency, this convolution is computed in the frequency domain using the Fast Fourier Transform:

$$U = \mathcal{F}^{-1}\!\big[\hat{K} \cdot \hat{A}\big]$$

where $\hat{K}$ and $\hat{A}$ are the FFT of the kernel and field, respectively, and $\cdot$ denotes element-wise complex multiplication.

#### 2.2 Growth Mapping

The growth value at each cell is a function of the local potential:

$$G_t(x) = G(U_t(x);\; m,\; s)$$

The functional form of $G$ depends on the selected growth family $gn$ (see §4).

#### 2.3 Time Integration

The field is updated by adding a scaled growth increment and clipping to $[0, 1]$:

$$A_{t+dt}(x) = \text{clip}\!\big(A_t(x) + h\,dt \cdot G_t(x),\; 0,\; 1\big)$$

where $dt = 1/T$ is the timestep size and $h$ is the optional step-size
coefficient. See §5 for alternative integration modes.

---

### 3. Kernel Function

The kernel is a radially-symmetric function with support on $[0, R]$, optionally divided into multiple concentric shells weighted by a coefficient vector $\mathbf{b} = (b_0, b_1, \ldots)$.

#### 3.1 Shell Interpolation

For normalised radius $\tilde d = \|x\|/R$ and relative kernel support radius
$r_r$ (parameter `r`, default $1$):

$$\tilde d \ge r_r \Rightarrow K = 0, \qquad B_r = \frac{|\mathbf{b}|\,\tilde d}{r_r}, \qquad \text{idx} = \min(\lfloor B_r \rfloor,\; |\mathbf{b}| - 1), \qquad f = B_r \bmod 1$$

The shell weight is selected as $b_{\text{idx}}$, and the core function is
evaluated within that shell as $k(\min(f, 1))$.

#### 3.2 Kernel Core Functions

Four families are available via the parameter $kn$:

| $kn$ | Name | Formula |
| :--: | :-- | :-- |
| 1 | Polynomial | $k(r) = \big(4r(1-r)\big)^4$ |
| 2 | Exponential | $k(r) = \exp\!\big(4 - 1/(r(1-r))\big)$ for $0 < r < 1$, else $0$ |
| 3 | Step | $k(r) = \begin{cases} 1 & 0.25 \leq r \leq 0.75 \\ 0 & \text{otherwise} \end{cases}$ |
| 4 | Staircase | Step variant with half-weight for $r < 0.25$ |

#### 3.3 Normalisation

After construction, the kernel is normalised so that all weights sum to unity:

$$K'(x) = \frac{K(x)}{\sum_y K(y)}$$

This ensures that convolution preserves the field's value range and that the growth function receives consistent inputs regardless of $R$.

---

### 4. Growth Function Families

Three families are available via the parameter $gn$. All map $U \in [0, 1]$ to $G \in [-1, 1]$, where positive values represent growth and negative values represent decay. The result is shifted so that $G = -1$ corresponds to no relevant potential.

#### 4.1 Polynomial ($gn = 1$, default)

$$G(u;\; m,\; s) = \begin{cases} \left(1 - \dfrac{(u - m)^2}{9s^2}\right)^{\!4} \cdot 2 - 1 & (u - m)^2 < 9s^2 \\[6pt] -1 & \text{otherwise} \end{cases}$$

Compact support (exactly zero outside $m \pm 3s$). This is the original Lenia growth function.

#### 4.2 Exponential ($gn = 2$)

$$G(u;\; m,\; s) = \exp\!\left(-\frac{(u - m)^2}{2s^2}\right) \cdot 2 - 1$$

Gaussian bell, never exactly zero but negligibly small far from $m$.

#### 4.3 Step ($gn = 3$)

$$G(u;\; m,\; s) = \begin{cases} 1 & |u - m| \leq s \\ -1 & \text{otherwise} \end{cases}$$

Binary growth/decay gate. Reproduces Larger-than-Life and Smooth Life rules as special cases.

> [!NOTE]
> Growth functions are evaluated via precomputed lookup tables (32 768 entries) with linear sub-LUT interpolation for performance. The polynomial and exponential families each have a dedicated LUT.

---

### 5. Time Integration Modes

#### 5.1 Standard (default)

$$A_{t+dt} = \text{clip}(A_t + h\,dt \cdot G_t,\; 0,\; 1)$$

#### 5.2 Arita Mode

Dampens oscillations by blending toward the growth target:

$$D = \frac{G_t + 1}{2} - A_t, \qquad A_{t+dt} = \text{clip}(A_t + h\,dt \cdot D,\; 0,\; 1)$$

#### 5.3 Multi-Step (3rd-order BDF)

Uses current and previous growth fields for higher-order accuracy:

$$D = \tfrac{1}{2}(3\, G_t - G_{t-1}), \qquad A_{t+dt} = \text{clip}(A_t + h\,dt \cdot D,\; 0,\; 1)$$

#### 5.4 Clipping Modes

* Hard clip: $\max(0,\, \min(1,\, x))$
* Soft clip: Smooth sigmoid approximation avoiding discontinuities at the boundaries.

---

### 6. N-Dimensional Extension

The same algorithm generalises to arbitrary dimension $d$ by replacing the 2D FFT with an $N$-dimensional pencil decomposition:

$$\hat{A} = \text{FFT}_{d}\!(A): \quad \text{apply 1D FFT along each axis sequentially}$$

| Dimension | Supported Grid Sizes | Default |
| :--: | :-- | :--: |
| 2D | 64, 128, 256, 512, 1024, 2048 | 128 |
| 3D | 32, 64, 128, 256 | 64 |
| 4D | 16, 32, 64, 128 | 32 |

#### 6.1 Visualisation

For $d > 2$, two viewing modes are available:

* Slice: a 2D cross-section at selected depth indices $(z, w)$.
* Projection: max or average projection over the extra axes.

---

### 7. Model Parameters

#### 7.1 Core Parameters

| Parameter | Symbol | Default | Range | Description |
| :-- | :--: | :--: | :--: | :-- |
| Interaction radius | $R$ | 13 | 2–50 | Kernel support radius (cells) |
| Time scale | $T$ | 10 | 1–1500 | Inverse timestep ($dt = 1/T$) |
| Growth centre | $m$ | 0.15 | 0–1 | Preferred local potential |
| Growth width | $s$ | 0.015 | 0.0001+ | Tolerance around $m$ |
| Shell weights | $\mathbf{b}$ | $[1]$ | Real array | Multi-shell kernel weights |
| Kernel family | $kn$ | 1 | 1–4 | Kernel core function |
| Growth family | $gn$ | 1 | 1–3 | Growth function family |

#### 7.2 Integration Options

| Parameter | Default | Description |
| :-- | :--: | :-- |
| `softClip` | false | Use smooth sigmoid clipping |
| `multiStep` | false | 3rd-order BDF integration |
| `aritaMode` | false | Arita dampening |
| `h` | 1.0 | Step-size coefficient (0.1–1.0) |
| `addNoise` | 0 | Per-step noise injection (0–1, in tenths) |
| `maskRate` | 0 | Random cell zeroing rate (0–1, in tenths) |

#### 7.3 Grid and Display

| Parameter | Default | Range |
| :-- | :--: | :--: |
| Grid size | 256 (2D) | 64–2048 |
| Pixel size | 4 (2D) | 1–128 |
| Dimension | 2 | 2, 3, 4 |

---

### 8. Architecture

#### 8.1 FFT Pipeline

The worker implements a Cooley–Tukey radix-2 FFT algorithm with cached twiddle factors. The full stepping pipeline is as follows:

``` text
1. Zero-pad cells A into interleaved complex buffer [Re, Im, Re, Im, …]
2. Forward FFT (row/column for 2D, pencil for ND)
3. Element-wise complex multiplication: Û = Â ⊗ K̂
4. Inverse FFT → potential U
5. Growth mapping via LUT: G(U; m, s)
6. Time integration: A ← clip(A + dt·G)
```

Buffers are transferred with ownership (zero-copy `ArrayBuffer` transfer) between main thread and worker.

#### 8.2 Organism Catalogue

Three JSON libraries contain presets organised by biological-style taxonomy:

* `animals.json` — 2D organisms
* `animals3D.json` — 3D organisms
* `animals4D.json` — 4D organisms

Each preset stores parameters $(R, T, m, s, \mathbf{b}, kn, gn)$ and an RLE-compressed initial pattern. Classification follows Chan's notation with codes like `O2u` (Orbium unicaudatus) which map to genus/species pairs.

#### 8.3 Rendering Modes

| Mode | Data Source | Description |
| :-- | :-- | :-- |
| World | Cell state $A$ | Primary view — LUT-coloured cell values |
| Potential | $U$ | Convolution output heat map |
| Growth | $G$ | Growth/decay map (divergent colour: red = growth, blue = decay) |
| Kernel | $K$ | Interaction kernel shape |

Five polar overlay modes (off, symmetry, polar, history, strength) and eight additional overlays (grid, scale bar, legend, statistics, motion, symmetry, calculation panels, organism name) are togglable.

#### 8.4 Analysis Engine

Per-frame statistics include:

| Category | Metrics |
| :-- | :-- |
| Mass & Growth | Total mass $\sum A$, positive growth $\sum \max(0, G)$, peak cell value |
| Position | Centre of mass (Fourier-based toroidal centroid), growth centroid, centre distance |
| Motion | Speed, centroid velocity, angle, rotation speed |
| Symmetry | Rotational order $k$, strength (0–1), asymmetry, rotation rate |
| Shape | Gyradius, Hu moment invariants (1, 4–7), Flusser moment invariants (7–10) |
| Periodicity | Detected oscillation period (mass autocorrelation), confidence |

Symmetry detection decomposes polar samples from the centroid into Fourier harmonics and identifies the dominant rotational order.

---

### 9. Controls

#### 9.1 Simulation

| Key | Action |
| :-- | :-- |
| `Enter` | Run / pause |
| `Space` | Single step |
| `Del` / `Backspace` | Clear world |
| `N` | Randomise cells (`Shift` = seeded) |

#### 9.2 Parameter Adjustment

| Keys | Parameter | Step | Shift (10×) |
| :--: | :--: | :--: | :--: |
| `Q` / `A` | $m$ | ±0.001 | ±0.01 |
| `W` / `S` | $s$ | ±0.0001 | ±0.001 |
| `R` / `F` | $R$ | ±10 | ±1 |
| `T` / `G` | $T$ | ×2 / ÷2 | ±1 |
| `E` / `D` | paramP | ±10 | ±1 |
| `;` / `'` | $\mathbf{b}$ | Remove / add shell | — |
| `Ctrl+Y` | $kn$ | Cycle 1→2→3→4→1 | — |
| `Ctrl+U` | $gn$ | Cycle 1→2→3→1 | — |
| `Ctrl+I` | Soft clip | Toggle | — |
| `Ctrl+O` | Noise | Cycle 0→1 (tenths) | — |
| `Ctrl+P` | Arita mode | Toggle | — |
| `Ctrl+M` | Multi-step | Toggle | — |

#### 9.3 Organism Catalogue

| Key | Action |
| :-- | :-- |
| `Z` | Load selected preset |
| `C` / `V` | Previous / next organism (`Shift` = ±10) |
| `X` | Place organism at random position (`Shift` = toggle place mode) |
| `M` | Random parameters (`Shift` = extreme) |

#### 9.4 World Transformations

| Key | Action |
| :-- | :-- |
| `←` `→` `↑` `↓` | Pan ±10 cells (`Shift` = ±1) |
| `Ctrl+←` / `Ctrl+→` | Rotate ±90° |
| `=` | Flip horizontal (`Shift` = vertical) |
| `-` | Transpose |

#### 9.5 Display

| Key | Action |
| :-- | :-- |
| `Tab` | Cycle render mode (`Shift` = reverse) |
| `,` / `.` | Cycle colour map |
| `G` | Grid overlay (`Shift` = general overlay) |
| `L` / `B` / `O` | Legend / scale bar / statistics |
| `J` | Motion overlay (`Shift` = animal name, `Ctrl` = symmetry) |
| `K` | Calculation panels |
| `'` | Auto-centre (`Shift` = auto-rotate, `Ctrl` = polar mode) |

#### 9.6 N-Dimensional

| Key | Action |
| :-- | :-- |
| `PgUp` / `PgDn` | Z slice ±10 (`Shift` = ±1) |
| `Shift+Scroll` | W slice (4D) |
| `Ctrl+End` | Toggle slice / projection |
| `Ctrl+D` | Cycle dimension (2→3→4) |

#### 9.7 Import / Export

| Key | Action |
| :-- | :-- |
| `H` | Toggle GUI panel |
| `#` | Toggle keymap reference |
| `Shift+P` | Export parameters (JSON) |
| `Shift+I` | Import parameters (JSON) |
| `Shift+J` | Export statistics (JSON) |
| `Shift+K` | Export statistics (CSV) |
| `Shift+W` | Export world (JSON + grids) |
| `Shift+Q` | Import world (JSON) |
| `F` | Export image |
| `V` | Start / stop recording |

---

### References

* Chan, B.W.-C. Lenia: Biology of Artificial Life. *arXiv* 1812.05433 (2019). Complex Systems, 2019, 28(3), 251-286. <https://arxiv.org/abs/1812.05433> DOI: <https://doi.org/10.48550/arXiv.1812.05433>. Related DOI: <https://doi.org/10.25088/ComplexSystems.28.3.251>
* Chan, B.W.-C. Lenia and Expanded Universe. *arXiv* 2005.03742 (2020). Artificial Life Conference Proceedings 2020, 32, 221-229. <https://arxiv.org/abs/2005.03742> DOI: <https://doi.org/10.48550/arXiv.2005.03742>. Related DOI: <https://doi.org/10.1162/isal_a_00297>
* Lenia project page and interactive demos: <https://chakazul.github.io/lenia.html>
* Lenia rule summary: <https://en.wikipedia.org/wiki/Lenia>

---

### Run

```bash
cd sketchbook/Lenia_ND_Studio
python3 -m http.server 8080
```

Open `http://localhost:8080`.

# Lenia 2D Studio

## Overview

Continuous cellular automata studio inspired by Lenia, designed for experimenting with smooth life-like dynamics, kernels, and species presets.

## Implementation

- Modular p5.js application (`Automaton`, `Board`, `Renderer`, `Analyser`, `GUI`)
- Preset library via `animals.json`
- Includes `LENIAND_PORT.md` notes for related porting context

## Controls

- Load and test predefined organisms
- Adjust kernel and growth parameters
- Tune simulation speed and visualisation settings

### Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `#` | Toggle keyboard reference overlay |
| `Space` | Pause or resume simulation |
| `N` | Step one generation |
| `A / D` | Load previous or next animal |
| `F` | Load currently selected animal |
| `P` | Toggle place mode for click placement |
| `Z` | Randomise world |
| `X` | Clear world |
| `R` | Reset simulation state |
| `Tab` | Cycle render mode (`world → potential → field → kernel`) |
| `T` | Cycle colour map |
| `G` | Toggle grid |
| `L` | Toggle colour legend |
| `O` | Toggle statistics overlay |
| `M` | Toggle motion overlay (centre dot + direction arrow) |
| `B` | Toggle scale bar |
| `H` | Hide or show GUI panel |
| `V` | Cycle grid size (`64 / 128 / 256`) |
| `[ / ]` | Decrease or increase kernel radius `R` |
| `; / '` | Decrease or increase time integration `T` |
| `, / .` | Decrease or increase growth centre `m` |
| `- / +` | Decrease or increase growth width `s` |
| `← / →` | Decrease or increase noise |
| `↓ / ↑` | Decrease or increase mask rate |
| `K` | Cycle kernel function |
| `Y` | Cycle growth function |
| `U` | Toggle soft clipping |
| `I` | Toggle multi-step integration |
| `S` | Save canvas as PNG |
| `E` | Export world state (JSON) |
| `C` | Export statistics (CSV) |

## How to Run

### Browser (p5.js/WebGL)

```bash
cd sketchbook/Lenia_2D_Studio
python3 -m http.server 8080
```

Open `http://localhost:8080`.

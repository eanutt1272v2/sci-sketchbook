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
|-----|--------|
| `M` | Toggle motion overlay (centre dot + direction arrow) |
| `S` | Save canvas as PNG |
| `E` | Export world state (JSON) |
| `C` | Export statistics (CSV) |
| `R` | Reset simulation to defaults |

## How to Run

### Browser (p5.js/WebGL)
```bash
cd sketchbook/Lenia_2D_Studio
python3 -m http.server 8080
```
Open `http://localhost:8080`.

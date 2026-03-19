# Lenia 2D Studio

## Overview

A continuous cellular automata implementation of Lenia, designed for experimenting with smooth life-like dynamics, kernels, and the organism catalogue.

The model uses continuous state values and convolution-based local interaction, which makes many patterns more resilient and organism-like than binary cellular automata (e.g. GoL, which is actually in the bottom of the catalogue, along, with smooth life).

## Method

Let `A_t(x) in [0,1]` denote field intensity at position `x` and time `t`.

The update loop follows the pipeline:

1. Compute potential through convolution: `U_t(x) = (K * A_t)(x)`
2. Apply growth mapping: `G_t(x) = G(U_t(x); m, s)`
3. Integrate in time: `A_{t+dt}(x) = clip(A_t(x) + dt * G_t(x), 0, 1)`

`dt` is controlled by the time-scale parameter `T`.

Control parameters include `R`, `T`, `m`, `s`, kernel/growth families (`kn`, `gn`), clipping mode, and optional multi-step integration:

- `R`: interaction radius (kernel support)
- `T`: temporal scale / update speed
- `m`: growth-centre (preferred potential)
- `s`: growth-width (tolerance around `m`)

For larger grids, convolution is accelerated in `FFTWorker.js`.

## Architecture

- `AppCore.js`: management of worker and other components
- `FFTWorker.js`: kernel generation and world-step execution
- `Automaton.js`, `Board.js`: world state and updating
- `Renderer.js`: world/potential/field/kernel render modes
- `Analyser.js`: motion and morphology statistics
- `AnimalLibrary.js`, `animals.json`: preset management
- `GUI.js`, `InputHandler.js`, `Media.js`: controls and export systems

## Controls

- `Space`: run/pause
- `N`: single step
- `A / D`: previous/next animal
- `F`: load selected animal
- `Tab`: cycle render mode
- `G/L/O/M/B`: overlay toggles
- `[ ]`, `; '`, `, .`, `- +`: key parameter nudges
- see keymap for extended reference

## Notes

- The keymap overlay (`#`) shows full keyboard control details.
- Small changes in `m`, `s`, and `R` can alter behaviour (extinction, stable motion, oscillation, and explosion).

## References

- Bert Wang-Chak Chan, "Lenia: Biology of Artificial Life" (2019): <https://arxiv.org/abs/1812.05433>
- Lenia project and demos: <https://chakazul.github.io/lenia.html>
- Lenia rule summary (quick reference): <https://en.wikipedia.org/wiki/Lenia>

## Run

```bash
cd sketchbook/Lenia_2D_Studio
python3 -m http.server 8080
```

Open `http://localhost:8080`.

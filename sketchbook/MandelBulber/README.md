# MandelBulber

## Overview

Legacy Processing sketch for exploring a 3D Mandelbulb via escape-time iteration and boundary point-cloud rendering.

## Method

For each candidate point `c = (cx, cy, cz)`:
- Convert current state `z` to spherical coordinates
- Apply power transform (`p`, default `8`)
- Convert back to Cartesian and add `c`
- Repeat until escape or iteration cap

Points that remain bounded for sufficiently long are rendered as part of the fractal structure.

## Architecture

- `MandelBulber.pde`: Processing implementation of iteration, camera interaction, and render path

## Controls

- Camera/navigation controls are defined directly in sketch input handlers

## Notes

- This sketch is retained as a historical Processing implementation.

## Run

Open `sketchbook/MandelBulber/MandelBulber.pde` in Processing 4.x and run.

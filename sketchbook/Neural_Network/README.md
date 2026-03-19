# Neural Network

## Overview

Legacy Processing demonstration of handwritten-digit classification with an interactive drawing grid, sample labelling workflow, and in-sketch train/predict loop.

## Method

Default architecture in code:

`784 -> 128 -> 64 -> 10`

- Input: `28 x 28` flattened greyscale image (`784` features)
- Output: 10-class score vector for digits `0..9`

Training and inference are handled directly in-sketch with editable sample sets.

## Architecture

- `Neural_Network.pde`: UI, dataset handling, training loop, inference, and model serialisation

## Controls

- Draw with mouse
- Label samples (`0..9`)
- Predict, train, clear, and deduplicate dataset
- Use keyboard shortcuts for common actions

## Notes

- This project is a legacy Processing study and is kept for educational reference.

## Run

Open `sketchbook/Neural_Network/Neural_Network.pde` in Processing 4.x and run.
